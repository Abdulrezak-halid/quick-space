import type { FormEvent } from "react";
import type { Folder } from "../types/link";

type FolderOption = {
  id: string;
  label: string;
};

type FolderSidebarProps = {
  activeFolder: string;
  setActiveFolder: (value: string) => void;
  folderChildrenMap: Map<string | undefined, Folder[]>;
  folderOptions: FolderOption[];
  links: Array<{ folderId: string }>;
  linksByFolder: Record<string, number>;
  newFolderName: string;
  setNewFolderName: (value: string) => void;
  newFolderParentId: string;
  setNewFolderParentId: (value: string) => void;
  addFolder: (event: FormEvent<HTMLFormElement>) => void;
  editingFolderId: string | null;
  editFolderName: string;
  setEditFolderName: (value: string) => void;
  editFolderParentId: string;
  setEditFolderParentId: (value: string) => void;
  saveEditedFolder: (event: FormEvent<HTMLFormElement>) => void;
  cancelEditFolder: () => void;
  startEditFolder: (folder: Folder) => void;
  deleteFolder: (folderId: string) => void;
};

export const FolderSidebar = ({
  activeFolder,
  setActiveFolder,
  folderChildrenMap,
  folderOptions,
  links,
  linksByFolder,
  newFolderName,
  setNewFolderName,
  newFolderParentId,
  setNewFolderParentId,
  addFolder,
  editingFolderId,
  editFolderName,
  setEditFolderName,
  editFolderParentId,
  setEditFolderParentId,
  saveEditedFolder,
  cancelEditFolder,
  startEditFolder,
  deleteFolder,
}: FolderSidebarProps) => {
  const renderFolders = (parentId: string | undefined, depth: number): React.ReactNode[] => {
    const children = folderChildrenMap.get(parentId) ?? [];

    return children.flatMap((folder) => {
      const isActive = activeFolder === folder.id;
      const isEditing = editingFolderId === folder.id;

      const item = isEditing ? (
        <form
          key={folder.id}
          className="space-y-1.5 rounded-lg border border-blue-500/30 bg-blue-500/5 p-2"
          onSubmit={saveEditedFolder}
        >
          <input
            autoFocus
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-blue-400"
            onChange={(event) => setEditFolderName(event.target.value)}
            placeholder="Folder name"
            type="text"
            value={editFolderName}
          />
          <select
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-blue-400"
            onChange={(event) => setEditFolderParentId(event.target.value)}
            value={editFolderParentId}
          >
            <option value="">Top level</option>
            {folderOptions
              .filter((option) => option.id !== editingFolderId)
              .map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
          </select>
          <div className="flex gap-1.5">
            <button
              className="flex-1 rounded-md bg-emerald-600 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
              type="submit"
            >
              Save
            </button>
            <button
              className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-400 transition-colors hover:border-slate-500"
              onClick={cancelEditFolder}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div key={folder.id} className="group flex items-center gap-1" style={{ paddingLeft: depth * 10 }}>
          <button
            className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-all ${
              isActive
                ? "border border-blue-500/30 bg-blue-500/15 text-blue-200"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
            onClick={() => setActiveFolder(folder.id)}
            type="button"
          >
            <span className="truncate">{folder.name}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${isActive ? "bg-blue-500/20 text-blue-300" : "text-slate-600"}`}>
              {linksByFolder[folder.id] ?? 0}
            </span>
          </button>
          <button
            className="shrink-0 rounded-md p-1 text-slate-600 opacity-0 transition group-hover:opacity-100 hover:text-slate-300"
            onClick={() => startEditFolder(folder)}
            type="button"
            title="Edit folder"
          >
            Edit
          </button>
          <button
            className="shrink-0 rounded-md p-1 text-slate-600 opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
            onClick={() => deleteFolder(folder.id)}
            type="button"
            title="Delete folder"
          >
            Del
          </button>
        </div>
      );

      return [item, ...renderFolders(folder.id, depth + 1)];
    });
  };

  return (
    <aside className="flex w-full shrink-0 flex-col gap-1 border-r border-slate-800 bg-slate-900/40 px-2 py-3 lg:w-72">
      <button
        className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-all ${
          activeFolder === "all"
            ? "border border-blue-500/30 bg-blue-500/15 text-blue-200"
            : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
        }`}
        onClick={() => setActiveFolder("all")}
        type="button"
      >
        <span>All links</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${activeFolder === "all" ? "bg-blue-500/20 text-blue-300" : "text-slate-600"}`}>
          {links.length}
        </span>
      </button>

      <div className="mt-1 space-y-0.5">{renderFolders(undefined, 0)}</div>

      <div className="mt-auto border-t border-slate-800 pt-3">
        <form className="space-y-1.5" onSubmit={addFolder}>
          <p className="mb-2 px-1 text-[10px] uppercase tracking-widest text-slate-600">
            New folder
          </p>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-400"
            onChange={(event) => setNewFolderName(event.target.value)}
            placeholder="Folder name"
            type="text"
            value={newFolderName}
          />
          <select
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-blue-400"
            onChange={(event) => setNewFolderParentId(event.target.value)}
            value={newFolderParentId}
          >
            <option value="">Top level</option>
            {folderOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            className="w-full rounded-md border border-slate-700 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
            type="submit"
          >
            + Add folder
          </button>
        </form>
      </div>

    </aside>
  );
};