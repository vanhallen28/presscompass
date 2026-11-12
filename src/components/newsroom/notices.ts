// Messages shown after a redirect (`?notice=`), so a refresh or a shared link does not repeat an action.

type Kind = 'section' | 'tag' | 'author' | 'article';
type Notice = { tone: 'success' | 'error'; text: string };

const NAME: Record<Kind, string> = { section: 'Section', tag: 'Tag', author: 'Author', article: 'Article' };

const IN_USE: Partial<Record<Kind, string>> = {
  section: 'This section still has articles. Move them to another section before deleting it.',
  author: 'This author is credited on articles. Remove them from those articles before deleting.',
};

export function noticeFor(kind: Kind, code: string | string[] | undefined): Notice | null {
  switch (code) {
    case 'created':
      return { tone: 'success', text: `${NAME[kind]} created.` };
    case 'updated':
      return { tone: 'success', text: `${NAME[kind]} saved.` };
    case 'deleted':
      return { tone: 'success', text: `${NAME[kind]} deleted.` };
    case 'in-use':
      return { tone: 'error', text: IN_USE[kind] ?? `This ${kind} is still in use.` };
    case 'failed':
      return { tone: 'error', text: `The ${kind} could not be deleted. Try again.` };
    default:
      return null;
  }
}
