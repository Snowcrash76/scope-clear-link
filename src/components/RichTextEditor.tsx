import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = '96px',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder ?? 'Start typing...',
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.isEmpty ? '' : editor.getHTML());
    },
    editorProps: {
      attributes: {
          class: 'prose prose-sm dark:prose-invert max-w-none min-w-0 break-words [overflow-wrap:anywhere] focus:outline-none px-3 py-2 [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? '' : editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || '', false);
    }
  }, [value, editor]);

  if (!editor) return null;

  const ToolbarBtn = ({
    onClick,
    active,
    title,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      aria-label={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        active
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  );

  return (
    <div
      className={cn(
        'min-w-0 rounded-md border border-input bg-background ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        className
      )}
    >
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-input">
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered list"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarBtn>
      </div>
      <EditorContent editor={editor} style={{ minHeight }} />
    </div>
  );
}

export function htmlToText(html: string): string {
  if (!html) return '';
  const isHtml = /<[a-z][\s\S]*>/i.test(html);
  if (!isHtml) return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

const SAFE_RICH_TEXT_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li',
  'blockquote', 'code', 'pre', 'h1', 'h2', 'h3', 'hr', 'table',
  'thead', 'tbody', 'tr', 'th', 'td',
]);
const DROP_RICH_TEXT_SUBTREES = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math']);

function sanitizeRichTextHtml(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  const cleanRoot = document.createElement('div');

  const cleanNode = (node: Node): Node[] => {
    if (node.nodeType === Node.TEXT_NODE) {
      return [document.createTextNode(node.textContent ?? '')];
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return [];

    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    if (DROP_RICH_TEXT_SUBTREES.has(tag)) return [];
    const children = Array.from(element.childNodes).flatMap(cleanNode);

    // Preserve harmless text from unsupported formatting tags, but never copy
    // attributes such as event handlers, style, or unsafe URLs.
    if (!SAFE_RICH_TEXT_TAGS.has(tag)) return children;

    const cleanElement = document.createElement(tag);
    children.forEach(child => cleanElement.appendChild(child));
    return [cleanElement];
  };

  Array.from(template.content.childNodes).flatMap(cleanNode).forEach(node => cleanRoot.appendChild(node));
  return cleanRoot.innerHTML;
}

interface RichTextContentProps {
  html: string;
  className?: string;
}

export function RichTextContent({ html, className }: RichTextContentProps) {
  if (!html) return null;
  const isHtml = /<[a-z][\s\S]*>/i.test(html);
  if (!isHtml) {
    return (
      <p className={cn('text-sm text-muted-foreground whitespace-pre-wrap', className)}>
        {html}
      </p>
    );
  }
  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none min-w-0 break-words [overflow-wrap:anywhere] text-muted-foreground',
        '[&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_p]:my-0.5 [&_strong]:text-foreground [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto',
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(html) }}
    />
  );
}
