import { useState, type FormEvent } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Folder as FolderIcon,
} from "lucide-react";
import type { Folder } from "../types/link";

type FolderOption = {
  id: string;
  label: string;
};

type FolderSidebarProps = {
  activeFolder: string;
  setActiveFolder: (value: string) => void;
  isTrashActive: boolean;
  trashCount: number;
  onSelectTrash: () => void;
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
  moveFolder: (
    folderId: string,
    newParentId: string | undefined,
    anchorId?: string,
    position?: "before" | "after" | "inside",
  ) => void;
  moveLink: (linkId: string, newFolderId: string) => void;
};

export const FolderSidebar = ({
  activeFolder,
  setActiveFolder,
  isTrashActive,
  trashCount,
  onSelectTrash,
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
  saveEditedFolder,
  cancelEditFolder,
  startEditFolder,
  deleteFolder,
  moveFolder,
  moveLink,
}: FolderSidebarProps) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  type DropPosition = "before" | "after" | "inside";
  const [dragOverTarget, setDragOverTarget] = useState<{
    id: string | "all";
    position: DropPosition;
  } | null>(null);

  const toggleFolder = (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleDragStart = (
    e: React.DragEvent,
    id: string,
    type: "folder" | "link",
  ) => {
    e.dataTransfer.setData("type", type);
    e.dataTransfer.setData("id", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const getDropPosition = (event: React.DragEvent): DropPosition => {
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const offset = event.clientY - bounds.top;
    const threshold = bounds.height * 0.25;

    if (offset < threshold) {
      return "before";
    }

    if (offset > bounds.height - threshold) {
      return "after";
    }

    return "inside";
  };

  const handleDragOver = (
    e: React.DragEvent,
    targetId: string | "all",
    position: DropPosition = "inside",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    if (
      !dragOverTarget ||
      dragOverTarget.id !== targetId ||
      dragOverTarget.position !== position
    ) {
      setDragOverTarget({ id: targetId, position });
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
  };

  const handleDrop = (
    e: React.DragEvent,
    targetFolder: Folder | null,
    position: DropPosition,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);

    const type = e.dataTransfer.getData("type");
    const id = e.dataTransfer.getData("id");

    if (!id || !type) {
      return;
    }

    if (type === "folder") {
      if (!targetFolder) {
        moveFolder(id, undefined);
        return;
      }

      if (position === "inside") {
        moveFolder(id, targetFolder.id);
      } else {
        moveFolder(id, targetFolder.parentId, targetFolder.id, position);
      }
    }

    if (type === "link" && targetFolder) {
      moveLink(id, targetFolder.id);
    }
  };

  const renderFolders = (
    parentId: string | undefined,
    depth: number,
  ): React.ReactNode[] => {
    const children = folderChildrenMap.get(parentId) ?? [];

    return children.flatMap((folder) => {
      const isActive = activeFolder === folder.id;
      const isEditing = editingFolderId === folder.id;
      const hasChildren = (folderChildrenMap.get(folder.id) ?? []).length > 0;
      const isExpanded = expandedFolders.has(folder.id);
      const isDragOver = dragOverTarget?.id === folder.id;
      const dragPosition = isDragOver ? dragOverTarget?.position : null;

      const item = isEditing ? (
        <form
          key={folder.id}
          className="space-y-1.5 rounded-lg border border-blue-500/30 bg-blue-500/5 p-2 my-1"
          onSubmit={saveEditedFolder}
        >
          <input
            autoFocus
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white outline-none focus:border-blue-400 font-medium"
            onChange={(event) => setEditFolderName(event.target.value)}
            placeholder="Folder name"
            type="text"
            value={editFolderName}
          />
          <div className="flex gap-1.5">
            <button
              className="flex-1 rounded-md bg-emerald-600 py-1 text-xs font-bold text-white transition-colors hover:bg-emerald-500"
              type="submit"
            >
              Save
            </button>
            <button
              className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 font-medium transition-colors hover:border-slate-500"
              onClick={cancelEditFolder}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div key={folder.id} className="flex flex-col mb-[2px]">
          <div
            className={`group flex items-center justify-between gap-1 rounded-lg px-1.5 py-1 transition-all
              ${isActive ? "bg-blue-600/20 font-medium text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}
              ${dragPosition === "inside" ? "ring-2 ring-blue-500 ring-inset bg-blue-500/10" : ""}
              ${dragPosition === "before" ? "border-t-2 border-blue-500" : ""}
              ${dragPosition === "after" ? "border-b-2 border-blue-500" : ""}`}
            style={{ paddingLeft: `${depth * 14 + 6}px` }}
            onClick={() => setActiveFolder(folder.id)}
            draggable
            onDragStart={(e) => handleDragStart(e, folder.id, "folder")}
            onDragOver={(e) => handleDragOver(e, folder.id, getDropPosition(e))}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, folder, dragPosition ?? "inside")}
          >
            <div className="flex flex-1 items-center overflow-hidden gap-1.5">
              <button
                className={`p-0.5 rounded-md hover:bg-slate-700/50 ${hasChildren ? "text-slate-400 hover:text-slate-200" : "opacity-0"}`}
                onClick={(e) => hasChildren && toggleFolder(e, folder.id)}
                disabled={!hasChildren}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>

              <span className="truncate text-sm flex-1">{folder.name}</span>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mr-1">
              <button
                className="shrink-0 p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/50 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  setNewFolderParentId(folder.id);
                  setNewFolderName("");
                  if (!isExpanded) toggleFolder(e, folder.id);
                  const input = document.getElementById("new-folder-input");
                  if (input) {
                    input.scrollIntoView({ behavior: "smooth" });
                    input.focus();
                  }
                }}
                title="Add Subfolder"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                className="shrink-0 p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  startEditFolder(folder);
                }}
                title="Edit folder"
              >
                Edit
              </button>
              <button
                className="shrink-0 p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFolder(folder.id);
                }}
                title="Delete folder"
              >
                Del
              </button>
            </div>

            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums ml-1 ${isActive ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-slate-300"}`}
            >
              {linksByFolder[folder.id] ?? 0}
            </span>
          </div>

          {isExpanded && renderFolders(folder.id, depth + 1)}
        </div>
      );

      return [item];
    });
  };

  return (
    <aside className="flex w-full shrink-0 flex-col gap-2 border-r border-slate-800 bg-slate-950 px-3 py-4 lg:w-80">
      <div
        className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-all cursor-pointer
          ${activeFolder === "all" ? "bg-blue-600/20 text-white border border-blue-500/30" : "text-slate-300 hover:bg-slate-800 hover:text-white"}
          ${dragOverTarget?.id === "all" ? "ring-2 ring-blue-500 ring-inset" : ""}`}
        onClick={() => setActiveFolder("all")}
        onDragOver={(e) => handleDragOver(e, "all", "inside")}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, null, "inside")}
      >
        <div className="flex items-center gap-2">
          <FolderIcon className="w-4 h-4 text-blue-400" />
          <span>All links</span>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs tabular-nums font-bold ${activeFolder === "all" ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400"}`}
        >
          {links.length}
        </span>
      </div>

      <button
        type="button"
        className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-all
          ${isTrashActive ? "bg-rose-500/20 text-rose-100 border border-rose-400/40" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
        onClick={onSelectTrash}
      >
        <span>Trash</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs tabular-nums font-bold ${isTrashActive ? "bg-rose-500 text-white" : "bg-slate-800 text-slate-400"}`}
        >
          {trashCount}
        </span>
      </button>

      <div className="mt-2 space-y-0.5 overflow-y-auto flex-1">
        {renderFolders(undefined, 0)}
      </div>

      <div className="mt-auto border-t border-slate-800 pt-4">
        <form
          className="space-y-2 bg-slate-900/50 p-3 rounded-xl border border-slate-800"
          onSubmit={addFolder}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add folder
          </p>
          <input
            id="new-folder-input"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-white font-medium outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            onChange={(event) => setNewFolderName(event.target.value)}
            placeholder="Folder name"
            type="text"
            value={newFolderName}
            required
          />
          <select
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
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
            className="w-full rounded-md bg-blue-600 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-500 mt-1"
            type="submit"
          >
            Create Folder
          </button>
        </form>
      </div>
    </aside>
  );
};
