// Stand-in for the Supabase Data API (PostgREST) that runs real SQL on PostgreSQL with the
// request's role and JWT claims, so Row Level Security and SQL functions behave as on Supabase.
// It supports the subset of PostgREST that PressCompass uses: plain column lists (no embedding:
// joined reads go through SQL functions), filters eq/neq/gt/gte/lt/lte/like/ilike/is/in (with not.),
// order, limit/offset, count=exact, single-object responses, insert/upsert, update, delete and RPC.

const IDENT = /^[a-z_][a-z0-9_]*$/;
const OBJECT_TYPE = 'application/vnd.pgrst.object+json';
const RESERVED_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
const OPERATORS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' };

class RestError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function quote(name) {
  if (!IDENT.test(name)) throw new RestError(400, 'PGRST100', `The fake Data API does not support "${name}". Use a SQL function for joined reads.`);
  return `"${name}"`;
}

function selectList(select) {
  if (!select || select === '*') return '*';
  return select
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(quote)
    .join(', ');
}

function splitList(raw) {
  // "(a,b,\"c,d\")" -> ['a', 'b', 'c,d']
  const inner = raw.replace(/^\(/, '').replace(/\)$/, '');
  const items = [];
  let current = '';
  let quoted = false;
  for (const char of inner) {
    if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      items.push(current);
      current = '';
    } else current += char;
  }
  if (current !== '' || inner.endsWith(',')) items.push(current);
  return items;
}

function whereClause(params, values) {
  const push = (value) => {
    values.push(value);
    return `$${values.length}`;
  };
  const clauses = [];
  for (const [key, raw] of params) {
    if (RESERVED_PARAMS.has(key)) continue;
    const column = quote(key);
    let rest = raw;
    let negate = false;
    if (rest.startsWith('not.')) {
      negate = true;
      rest = rest.slice(4);
    }
    const dot = rest.indexOf('.');
    const op = rest.slice(0, dot);
    const value = rest.slice(dot + 1);
    let clause;
    if (op in OPERATORS) {
      const operand = op === 'like' || op === 'ilike' ? value.replaceAll('*', '%') : value;
      clause = `${column} ${OPERATORS[op]} ${push(operand)}`;
    } else if (op === 'is') {
      if (!['null', 'true', 'false'].includes(value)) throw new RestError(400, 'PGRST100', `Unsupported is.${value}`);
      clause = `${column} is ${value}`;
    } else if (op === 'in') {
      const items = splitList(value);
      clause = items.length ? `${column} in (${items.map(push).join(', ')})` : 'false';
    } else {
      throw new RestError(400, 'PGRST100', `The fake Data API does not support the "${op}" filter.`);
    }
    clauses.push(negate ? `not (${clause})` : clause);
  }
  return clauses.length ? ` where ${clauses.join(' and ')}` : '';
}

function orderClause(order) {
  if (!order) return '';
  const parts = order.split(',').map((part) => {
    const [column, ...flags] = part.split('.');
    const direction = flags.includes('desc') ? 'desc' : 'asc';
    const nulls = flags.includes('nullsfirst') ? ' nulls first' : flags.includes('nullslast') ? ' nulls last' : '';
    return `${quote(column)} ${direction}${nulls}`;
  });
  return ` order by ${parts.join(', ')}`;
}

function prefer(req) {
  const header = String(req.headers.prefer ?? '');
  return {
    count: /count=exact/.test(header),
    representation: /return=representation/.test(header),
    merge: /resolution=merge-duplicates/.test(header),
    ignore: /resolution=ignore-duplicates/.test(header),
  };
}

const wantsObject = (req) => String(req.headers.accept ?? '').includes(OBJECT_TYPE);

async function columnTypes(pool, cache, table) {
  if (!cache.has(table)) {
    const { rows } = await pool.query(
      `select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = $1`,
      [table],
    );
    if (!rows.length) throw new RestError(404, '42P01', `relation "public.${table}" does not exist`);
    cache.set(table, new Map(rows.map((row) => [row.column_name, row.data_type])));
  }
  return cache.get(table);
}

function toParam(value, type) {
  if (value === null || value === undefined) return null;
  if (type === 'json' || type === 'jsonb') return JSON.stringify(value);
  return value;
}

async function withRole(pool, claims, fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${quote(claims.role)}`);
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function statusFor(error) {
  if (error instanceof RestError) return error.status;
  const code = String(error.code ?? '');
  if (/^PT\d{3}$/.test(code)) return Number(code.slice(2));
  if (code === '23505' || code === '23503') return 409;
  if (code === '42501') return 403;
  if (code === '42883' || code === '42P01') return 404;
  if (code.startsWith('40') || code.startsWith('XX') || code.startsWith('P0') && code !== 'P0001') return 500;
  return 400;
}

function rowsResponse(req, rows, { status = 200, total } = {}) {
  const headers = {};
  if (total !== undefined) headers['content-range'] = rows.length ? `0-${rows.length - 1}/${total}` : `*/${total}`;
  if (wantsObject(req)) {
    if (rows.length !== 1) {
      return { status: 406, headers, body: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null } };
    }
    return { status, headers, body: rows[0] };
  }
  return { status, headers, body: rows };
}

async function readTable(pool, req, table, params) {
  const values = [];
  const where = whereClause(params, values);
  const options = prefer(req);
  return withRole(pool, req.claims, async (client) => {
    let total;
    if (options.count) total = Number((await client.query(`select count(*)::int as n from public.${quote(table)}${where}`, values)).rows[0].n);
    if (req.method === 'HEAD') return { status: 200, headers: { 'content-range': `*/${total ?? 0}` }, body: undefined };
    const limit = params.get('limit') ? ` limit ${Number.parseInt(params.get('limit'), 10)}` : '';
    const offset = params.get('offset') ? ` offset ${Number.parseInt(params.get('offset'), 10)}` : '';
    const sql = `select ${selectList(params.get('select'))} from public.${quote(table)}${where}${orderClause(params.get('order'))}${limit}${offset}`;
    const { rows } = await client.query(sql, values);
    return rowsResponse(req, rows, { total });
  });
}

async function insertRows(pool, cache, req, table, params, body) {
  const rows = Array.isArray(body) ? body : [body];
  const types = await columnTypes(pool, cache, table);
  // supabase-js sends `columns` for multi-row inserts, each name in double quotes.
  const columns = params.get('columns') ? params.get('columns').split(',').map((column) => column.trim().replace(/^"(.*)"$/, '$1')) : [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const values = [];
  const tuples = rows.map(
    (row) =>
      `(${columns
        .map((column) => {
          if (row[column] === undefined) return 'default';
          values.push(toParam(row[column], types.get(column)));
          return `$${values.length}`;
        })
        .join(', ')})`,
  );
  const options = prefer(req);
  let conflict = '';
  if (options.merge || options.ignore) {
    const target = (params.get('on_conflict') ?? '').split(',').filter(Boolean);
    if (!target.length) throw new RestError(400, 'PGRST100', 'The fake Data API needs on_conflict for upserts.');
    const updates = columns.filter((column) => !target.includes(column)).map((column) => `${quote(column)} = excluded.${quote(column)}`);
    conflict = ` on conflict (${target.map(quote).join(', ')}) do ${options.ignore || !updates.length ? 'nothing' : `update set ${updates.join(', ')}`}`;
  }
  const returning = options.representation ? ` returning ${selectList(params.get('select'))}` : '';
  const sql = `insert into public.${quote(table)} (${columns.map(quote).join(', ')}) values ${tuples.join(', ')}${conflict}${returning}`;
  return withRole(pool, req.claims, async (client) => {
    const result = await client.query(sql, values);
    return options.representation ? rowsResponse(req, result.rows, { status: 201 }) : { status: 201, body: undefined };
  });
}

async function updateRows(pool, cache, req, table, params, body) {
  const types = await columnTypes(pool, cache, table);
  const values = [];
  const sets = Object.entries(body).map(([column, value]) => {
    values.push(toParam(value, types.get(column)));
    return `${quote(column)} = $${values.length}`;
  });
  if (!sets.length) throw new RestError(400, 'PGRST100', 'Nothing to update.');
  const where = whereClause(params, values);
  const options = prefer(req);
  const returning = options.representation ? ` returning ${selectList(params.get('select'))}` : '';
  return withRole(pool, req.claims, async (client) => {
    const result = await client.query(`update public.${quote(table)} set ${sets.join(', ')}${where}${returning}`, values);
    return options.representation ? rowsResponse(req, result.rows) : { status: 204, body: undefined };
  });
}

async function deleteRows(pool, req, table, params) {
  const values = [];
  const where = whereClause(params, values);
  const options = prefer(req);
  const returning = options.representation ? ` returning ${selectList(params.get('select'))}` : '';
  return withRole(pool, req.claims, async (client) => {
    const result = await client.query(`delete from public.${quote(table)}${where}${returning}`, values);
    return options.representation ? rowsResponse(req, result.rows) : { status: 204, body: undefined };
  });
}

async function callFunction(pool, req, name, args) {
  const { rows: found } = await pool.query(
    `select p.proretset as set, t.typtype as kind, t.typname as type,
            coalesce(p.proargnames, '{}') as names,
            array(select format_type(oid, null) from unnest(p.proargtypes::oid[]) with ordinality as a(oid, n) order by n) as arg_types
       from pg_proc p
       join pg_namespace ns on ns.oid = p.pronamespace
       join pg_type t on t.oid = p.prorettype
      where ns.nspname = 'public' and p.proname = $1`,
    [name],
  );
  if (found.length !== 1) throw new RestError(404, 'PGRST202', `Could not find the function public.${name}`);
  const fn = found[0];
  const values = [];
  const named = Object.entries(args ?? {}).map(([arg, value]) => {
    const index = fn.names.indexOf(arg);
    if (index < 0 || index >= fn.arg_types.length) throw new RestError(404, 'PGRST202', `public.${name} has no argument "${arg}"`);
    const type = fn.arg_types[index];
    values.push(toParam(value, type === 'jsonb' || type === 'json' ? type : null));
    return `${quote(arg)} => $${values.length}::${type}`;
  });
  const call = `public.${quote(name)}(${named.join(', ')})`;
  return withRole(pool, req.claims, async (client) => {
    if (fn.set) return rowsResponse(req, (await client.query(`select * from ${call}`, values)).rows);
    if (fn.kind === 'c') return { status: 200, body: (await client.query(`select * from ${call}`, values)).rows[0] ?? null };
    const { rows } = await client.query(`select ${call} as result`, values);
    return { status: 200, body: fn.type === 'void' ? null : rows[0].result };
  });
}

/** Handles /rest/v1/* requests with real SQL. Returns false for other paths. */
export async function handleRest(pool, cache, req, url, body, send) {
  if (!url.pathname.startsWith('/rest/v1/')) return false;
  const path = url.pathname.slice('/rest/v1/'.length);
  try {
    let result;
    if (path.startsWith('rpc/')) {
      result = await callFunction(pool, req, path.slice(4), body);
    } else {
      const table = path;
      quote(table);
      if (req.method === 'GET' || req.method === 'HEAD') result = await readTable(pool, req, table, url.searchParams);
      else if (req.method === 'POST') result = await insertRows(pool, cache, req, table, url.searchParams, body);
      else if (req.method === 'PATCH') result = await updateRows(pool, cache, req, table, url.searchParams, body);
      else if (req.method === 'DELETE') result = await deleteRows(pool, req, table, url.searchParams);
      else throw new RestError(405, 'PGRST117', `Unsupported method ${req.method}`);
    }
    send(result.status, result.body, result.headers);
  } catch (error) {
    send(statusFor(error), { code: String(error.code ?? 'PGRST000'), message: error.message, details: error.detail ?? null, hint: error.hint ?? null });
  }
  return true;
}
