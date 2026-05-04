import type { FormEvent } from "react";
import type { LinkItem } from "../types/link";

type FolderOption = {
  id: string;
  label: string;
};

type EditLinkFormProps = {
  link: LinkItem;
  folderOptions: FolderOption[];
  editTitle: string;
  editUrl: string;
  editBadge: string;
  editFolderId: string;
  setEditTitle: (value: string) => void;
  setEditUrl: (value: string) => void;
  setEditBadge: (value: string) => void;
  setEditFolderId: (value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

export const EditLinkForm = ({
  link,
  folderOptions,
  editTitle,
  editUrl,
  editBadge,
  editFolderId,
  setEditTitle,
  setEditUrl,
  setEditBadge,
  setEditFolderId,
  onSave,
  onCancel,
}: EditLinkFormProps) => {
  return (
    <article className="rounded-xl border border-blue-500/40 bg-blue-500/5 p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-blue-400">
        Editing: {link.title}
      </p>
      <form className="space-y-2" onSubmit={onSave}>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-400"
            onChange={(event) => setEditTitle(event.target.value)}
            placeholder="Title"
            type="text"
            value={editTitle}
          />
          <input
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-400"
            onChange={(event) => setEditUrl(event.target.value)}
            placeholder="URL"
            type="text"
            value={editUrl}
          />
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-400"
            onChange={(event) => setEditBadge(event.target.value)}
            placeholder="Badge (optional)"
            type="text"
            value={editBadge}
          />
          <select
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400"
            onChange={(event) => setEditFolderId(event.target.value)}
            value={editFolderId}
          >
            {folderOptions.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
            type="submit"
          >
            Save
          </button>
          <button
            className="rounded-lg border border-slate-700 px-4 py-1.5 text-sm text-slate-300 transition-colors hover:border-slate-500"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
      </form>
    </article>
  );
};