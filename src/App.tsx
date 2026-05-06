import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Download, Plus, Search, Star, Upload } from "lucide-react";
import { EditLinkForm } from "./components/EditLinkForm";
import { FolderSidebar } from "./components/FolderSidebar";
import { LinkCard } from "./components/LinkCard";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { useKeyboardShortcut } from "./hooks/useKeyboardShortcut";
import { useLauncherTree } from "./hooks/useLauncherTree";
import { loadLauncherData, saveLauncherData } from "./storage/linkStorage";
import type {
  Folder,
  LauncherData,
  LinkItem,
  TrashedFolder,
  TrashedLink,
} from "./types/link";

const normalizeUrl = (url: string): string => {
  const cleaned = url.trim();

  if (!cleaned) {
    return cleaned;
  }

  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    return cleaned;
  }

  return `https://${cleaned}`;
};

const createId = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const isValidLauncherData = (value: unknown): value is LauncherData => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const parsed = value as {
    folders?: unknown;
    links?: unknown;
    trashedFolders?: unknown;
    trashedLinks?: unknown;
  };

  const trashFoldersValid =
    parsed.trashedFolders === undefined || Array.isArray(parsed.trashedFolders);
  const trashLinksValid =
    parsed.trashedLinks === undefined || Array.isArray(parsed.trashedLinks);

  return (
    Array.isArray(parsed.folders) &&
    Array.isArray(parsed.links) &&
    trashFoldersValid &&
    trashLinksValid
  );
};

function App() {
  const [launcher, setLauncher] = useState<LauncherData>(() =>
    loadLauncherData(),
  );
  const [query, setQuery] = useState("");
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);

  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState("");

  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkBadge, setNewLinkBadge] = useState("");
  const [newLinkFolderId, setNewLinkFolderId] = useState(
    launcher.folders[0]?.id ?? "",
  );

  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [editFolderParentId, setEditFolderParentId] = useState("");

  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editBadge, setEditBadge] = useState("");
  const [editFolderId, setEditFolderId] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebouncedValue(query, 300);

  useKeyboardShortcut("k", () => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  });

  useEffect(() => {
    saveLauncherData(launcher);
  }, [launcher]);

  const isTrashView = activeFolder === "trash";
  const treeActiveFolder = isTrashView ? "all" : activeFolder;

  const {
    folderMap,
    folderChildrenMap,
    folderOptions,
    folderPathById,
    linksByFolder,
    filteredLinks,
    activeFolderName,
  } = useLauncherTree(
    launcher,
    debouncedQuery,
    treeActiveFolder,
    favoritesOnly,
  );

  const trashFolderCount = launcher.trashedFolders.length;
  const trashLinkCount = launcher.trashedLinks.length;
  const trashCount = trashFolderCount + trashLinkCount;

  const normalizedTrashQuery = debouncedQuery.trim().toLowerCase();
  const trashedFoldersFiltered = launcher.trashedFolders.filter((folder) =>
    normalizedTrashQuery.length === 0
      ? true
      : folder.name.toLowerCase().includes(normalizedTrashQuery),
  );
  const trashedLinksFiltered = launcher.trashedLinks.filter((link) => {
    if (normalizedTrashQuery.length === 0) {
      return true;
    }

    const haystack =
      `${link.title} ${link.badge ?? ""} ${link.url}`.toLowerCase();
    return haystack.includes(normalizedTrashQuery);
  });

  const addFolder = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const name = newFolderName.trim();
    if (!name) {
      return;
    }

    const parentId = newFolderParentId || undefined;
    const siblingOrders = launcher.folders
      .filter((folder) => folder.parentId === parentId)
      .map((folder) => folder.order ?? folder.createdAt);
    const nextOrder =
      siblingOrders.length > 0 ? Math.max(...siblingOrders) + 1 : 0;

    const folder: Folder = {
      id: createId(),
      name,
      parentId,
      order: nextOrder,
      createdAt: Date.now(),
    };

    setLauncher((current) => ({
      ...current,
      folders: [...current.folders, folder],
    }));

    setNewFolderName("");
    setNewFolderParentId("");
    setActiveFolder(folder.id);
    setNewLinkFolderId(folder.id);
  };

  const startEditFolder = (folder: Folder): void => {
    setEditingFolderId(folder.id);
    setEditFolderName(folder.name);
    setEditFolderParentId(folder.parentId ?? "");
  };

  const cancelEditFolder = (): void => {
    setEditingFolderId(null);
  };

  const saveEditedFolder = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (!editingFolderId) {
      return;
    }

    const name = editFolderName.trim();
    if (!name) {
      return;
    }

    const candidateParentId = editFolderParentId || undefined;
    const descendantIds = new Set<string>();

    const collectDescendants = (folderId: string): void => {
      descendantIds.add(folderId);
      (folderChildrenMap.get(folderId) ?? []).forEach((child) =>
        collectDescendants(child.id),
      );
    };

    collectDescendants(editingFolderId);

    if (candidateParentId && descendantIds.has(candidateParentId)) {
      alert("A folder cannot be moved inside itself or one of its subfolders.");
      return;
    }

    setLauncher((current) => ({
      ...current,
      folders: current.folders.map((folder) =>
        folder.id === editingFolderId
          ? { ...folder, name, parentId: candidateParentId }
          : folder,
      ),
    }));

    setEditingFolderId(null);
  };

  type FolderDropPosition = "before" | "after" | "inside";

  const moveFolder = (
    folderId: string,
    newParentId: string | undefined,
    anchorId?: string,
    position: FolderDropPosition = "inside",
  ): void => {
    if (folderId === newParentId) {
      return;
    }

    const descendantIds = new Set<string>();
    const collectDescendants = (id: string): void => {
      descendantIds.add(id);
      (folderChildrenMap.get(id) ?? []).forEach((child) =>
        collectDescendants(child.id),
      );
    };

    collectDescendants(folderId);

    if (newParentId && descendantIds.has(newParentId)) {
      alert("Cannot move a folder inside itself or its descendants.");
      return;
    }

    setLauncher((current) => {
      const movingFolder = current.folders.find(
        (folder) => folder.id === folderId,
      );
      if (!movingFolder) {
        return current;
      }

      const sortByOrder = (a: Folder, b: Folder): number => {
        const orderA = a.order ?? a.createdAt;
        const orderB = b.order ?? b.createdAt;
        return orderA - orderB || a.name.localeCompare(b.name);
      };

      const oldParentId = movingFolder.parentId;
      const targetParentId = newParentId;

      const siblingCandidates = current.folders
        .filter(
          (folder) =>
            folder.parentId === targetParentId && folder.id !== folderId,
        )
        .sort(sortByOrder);

      let insertIndex = siblingCandidates.length;
      if (anchorId) {
        const targetIndex = siblingCandidates.findIndex(
          (folder) => folder.id === anchorId,
        );
        if (targetIndex !== -1) {
          insertIndex = position === "before" ? targetIndex : targetIndex + 1;
        }
      }

      const reordered = [...siblingCandidates];
      reordered.splice(insertIndex, 0, {
        ...movingFolder,
        parentId: targetParentId,
      });

      const orderMap = new Map(
        reordered.map((folder, index) => [folder.id, index]),
      );
      const oldSiblings = current.folders
        .filter(
          (folder) => folder.parentId === oldParentId && folder.id !== folderId,
        )
        .sort(sortByOrder);
      const oldOrderMap = new Map(
        oldSiblings.map((folder, index) => [folder.id, index]),
      );

      return {
        ...current,
        folders: current.folders.map((folder) => {
          if (folder.id === folderId) {
            return {
              ...folder,
              parentId: targetParentId,
              order: orderMap.get(folderId),
            };
          }

          if (folder.parentId === targetParentId && orderMap.has(folder.id)) {
            return { ...folder, order: orderMap.get(folder.id) };
          }

          if (
            oldParentId !== targetParentId &&
            folder.parentId === oldParentId &&
            oldOrderMap.has(folder.id)
          ) {
            return { ...folder, order: oldOrderMap.get(folder.id) };
          }

          return folder;
        }),
      };
    });
  };

  const moveLink = (linkId: string, newFolderId: string): void => {
    setLauncher((current) => ({
      ...current,
      links: current.links.map((link) =>
        link.id === linkId ? { ...link, folderId: newFolderId } : link,
      ),
    }));
  };

  const deleteFolder = (folderId: string): void => {
    const allIds = new Set<string>();

    const collect = (id: string): void => {
      allIds.add(id);
      (folderChildrenMap.get(id) ?? []).forEach((child) => collect(child.id));
    };

    collect(folderId);

    const folderName = folderMap.get(folderId)?.name ?? "this folder";
    const subfolderCount = allIds.size - 1;
    const affectedLinks = launcher.links.filter((link) =>
      allIds.has(link.folderId),
    ).length;

    const confirmMessage =
      affectedLinks > 0
        ? `Move "${folderName}"${subfolderCount > 0 ? ` and ${subfolderCount} subfolder(s)` : ""} to Trash? This will also move ${affectedLinks} link(s) inside.`
        : `Move "${folderName}"${subfolderCount > 0 ? ` and ${subfolderCount} subfolder(s)` : ""} to Trash?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    const deletedAt = Date.now();
    const trashedFolders: TrashedFolder[] = launcher.folders
      .filter((folder) => allIds.has(folder.id))
      .map((folder) => ({ ...folder, deletedAt }));
    const trashedLinks: TrashedLink[] = launcher.links
      .filter((link) => allIds.has(link.folderId))
      .map((link) => ({ ...link, deletedAt }));

    setLauncher((current) => ({
      ...current,
      folders: current.folders.filter((folder) => !allIds.has(folder.id)),
      links: current.links.filter((link) => !allIds.has(link.folderId)),
      trashedFolders: [...current.trashedFolders, ...trashedFolders],
      trashedLinks: [...current.trashedLinks, ...trashedLinks],
    }));

    if (activeFolder === folderId || allIds.has(activeFolder)) {
      setActiveFolder("all");
    }
  };

  const addLink = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const title = newLinkTitle.trim();
    const url = normalizeUrl(newLinkUrl);

    if (!title || !url || !newLinkFolderId) {
      return;
    }

    const link: LinkItem = {
      id: createId(),
      title,
      url,
      folderId: newLinkFolderId,
      badge: newLinkBadge.trim() || undefined,
      favorite: false,
      createdAt: Date.now(),
    };

    setLauncher((current) => ({
      ...current,
      links: [link, ...current.links],
    }));

    setNewLinkTitle("");
    setNewLinkUrl("");
    setNewLinkBadge("");
    setAddPanelOpen(false);
    setActiveFolder(newLinkFolderId);
  };

  const removeLink = (id: string): void => {
    setLauncher((current) => {
      const link = current.links.find((item) => item.id === id);
      if (!link) {
        return current;
      }

      return {
        ...current,
        links: current.links.filter((item) => item.id !== id),
        trashedLinks: [
          ...current.trashedLinks,
          { ...link, deletedAt: Date.now() },
        ],
      };
    });
  };

  const toggleFavorite = (id: string): void => {
    setLauncher((current) => ({
      ...current,
      links: current.links.map((link) =>
        link.id === id ? { ...link, favorite: !link.favorite } : link,
      ),
    }));
  };

  const startEditLink = (link: LinkItem): void => {
    setEditingLinkId(link.id);
    setEditTitle(link.title);
    setEditUrl(link.url);
    setEditBadge(link.badge ?? "");
    setEditFolderId(link.folderId);
  };

  const saveEditedLink = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (!editingLinkId) {
      return;
    }

    const title = editTitle.trim();
    const url = normalizeUrl(editUrl);

    if (!title || !url || !editFolderId) {
      return;
    }

    setLauncher((current) => ({
      ...current,
      links: current.links.map((link) =>
        link.id === editingLinkId
          ? {
              ...link,
              title,
              url,
              folderId: editFolderId,
              badge: editBadge.trim() || undefined,
            }
          : link,
      ),
    }));

    setEditingLinkId(null);
  };

  const restoreFolderFromTrash = (folderId: string): void => {
    setLauncher((current) => {
      const trashedFolders = current.trashedFolders;
      const trashedLinks = current.trashedLinks;
      const restoreIds = new Set<string>();

      const collect = (id: string): void => {
        restoreIds.add(id);
        trashedFolders
          .filter((folder) => folder.parentId === id)
          .forEach((folder) => collect(folder.id));
      };

      collect(folderId);

      const folderIds = new Set(current.folders.map((folder) => folder.id));
      const foldersToRestore = trashedFolders
        .filter((folder) => restoreIds.has(folder.id))
        .map((folder) => ({
          ...folder,
          parentId:
            folder.parentId &&
            (folderIds.has(folder.parentId) || restoreIds.has(folder.parentId))
              ? folder.parentId
              : undefined,
          order: folder.order ?? folder.createdAt,
        }));

      const linksToRestore = trashedLinks.filter((link) =>
        restoreIds.has(link.folderId),
      );

      return {
        ...current,
        folders: [...current.folders, ...foldersToRestore],
        links: [...current.links, ...linksToRestore],
        trashedFolders: trashedFolders.filter(
          (folder) => !restoreIds.has(folder.id),
        ),
        trashedLinks: trashedLinks.filter(
          (link) => !restoreIds.has(link.folderId),
        ),
      };
    });
  };

  const restoreLinkFromTrash = (linkId: string): void => {
    setLauncher((current) => {
      const link = current.trashedLinks.find((item) => item.id === linkId);
      if (!link) {
        return current;
      }

      const fallbackFolderId = current.folders[0]?.id;
      const targetFolderId = current.folders.some(
        (folder) => folder.id === link.folderId,
      )
        ? link.folderId
        : fallbackFolderId;

      if (!targetFolderId) {
        return current;
      }

      return {
        ...current,
        links: [{ ...link, folderId: targetFolderId }, ...current.links],
        trashedLinks: current.trashedLinks.filter((item) => item.id !== linkId),
      };
    });
  };

  const deleteFolderFromTrash = (folderId: string): void => {
    setLauncher((current) => {
      const trashedFolders = current.trashedFolders;
      const trashedLinks = current.trashedLinks;
      const deleteIds = new Set<string>();

      const collect = (id: string): void => {
        deleteIds.add(id);
        trashedFolders
          .filter((folder) => folder.parentId === id)
          .forEach((folder) => collect(folder.id));
      };

      collect(folderId);

      return {
        ...current,
        trashedFolders: trashedFolders.filter(
          (folder) => !deleteIds.has(folder.id),
        ),
        trashedLinks: trashedLinks.filter(
          (link) => !deleteIds.has(link.folderId),
        ),
      };
    });
  };

  const deleteLinkFromTrash = (linkId: string): void => {
    setLauncher((current) => ({
      ...current,
      trashedLinks: current.trashedLinks.filter((item) => item.id !== linkId),
    }));
  };

  const emptyTrash = (): void => {
    if (!window.confirm("Permanently delete all items in Trash?")) {
      return;
    }

    setLauncher((current) => ({
      ...current,
      trashedFolders: [],
      trashedLinks: [],
    }));
  };

  const exportAsJson = (): void => {
    const fileName = `quickspace-export-${new Date().toISOString().slice(0, 10)}.json`;
    const content = JSON.stringify(launcher, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(objectUrl);
  };

  const triggerImport = (): void => {
    importInputRef.current?.click();
  };

  const importFromJson = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;

      if (!isValidLauncherData(parsed)) {
        alert("Invalid JSON format for QuickSpace import.");
        return;
      }

      const normalized: LauncherData = {
        ...(parsed as LauncherData),
        trashedFolders: (parsed as LauncherData).trashedFolders ?? [],
        trashedLinks: (parsed as LauncherData).trashedLinks ?? [],
      };

      setLauncher(normalized);
      setActiveFolder("all");
      setNewLinkFolderId(normalized.folders[0]?.id ?? "");
      alert("Import completed successfully.");
    } catch {
      alert("Failed to import JSON file.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 flex flex-col gap-3 border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur-md lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold tracking-tight text-slate-100">
            QuickSpace
          </h1>
          <span className="text-xs text-slate-500">
            {isTrashView
              ? `${trashLinkCount} link${trashLinkCount !== 1 ? "s" : ""} + ${trashFolderCount} folder${trashFolderCount !== 1 ? "s" : ""} in Trash`
              : `${filteredLinks.length} link${filteredLinks.length !== 1 ? "s" : ""}${
                  treeActiveFolder !== "all" ? ` in ${activeFolderName}` : ""
                }`}
          </span>
        </div>

        <label className="relative w-full max-w-xl lg:mx-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && filteredLinks.length > 0) {
                event.preventDefault();
                window.open(
                  filteredLinks[0].url,
                  "_blank",
                  "noopener,noreferrer",
                );
              }
            }}
            placeholder="Search title, badge, or URL..."
            className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-14 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600">
            Ctrl + K
          </kbd>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFavoritesOnly((current) => !current)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition ${
              favoritesOnly
                ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200"
            }`}
          >
            <Star className="h-3.5 w-3.5" />
            Starred
          </button>

          <button
            type="button"
            onClick={() => setAddPanelOpen((current) => !current)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
              addPanelOpen
                ? "border-blue-500/50 bg-blue-500/15 text-blue-300"
                : "border-slate-700 bg-blue-600 text-white hover:bg-blue-500"
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            Add link
          </button>

          <button
            type="button"
            onClick={exportAsJson}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>

          <button
            type="button"
            onClick={triggerImport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
          >
            <Upload className="h-3.5 w-3.5" />
            Import
          </button>

          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={importFromJson}
          />
        </div>
      </header>

      {addPanelOpen && (
        <div className="border-b border-slate-800 bg-slate-900/80 px-4 py-4">
          <form className="mx-auto max-w-4xl space-y-3" onSubmit={addLink}>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              New link
            </p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <input
                autoFocus
                value={newLinkTitle}
                onChange={(event) => setNewLinkTitle(event.target.value)}
                placeholder="Title"
                type="text"
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500"
              />
              <input
                value={newLinkUrl}
                onChange={(event) => setNewLinkUrl(event.target.value)}
                placeholder="https://example.com"
                type="text"
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500"
              />
              <input
                value={newLinkBadge}
                onChange={(event) => setNewLinkBadge(event.target.value)}
                placeholder="Badge (optional)"
                type="text"
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500"
              />
              <select
                value={newLinkFolderId}
                onChange={(event) => setNewLinkFolderId(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
              >
                {folderOptions.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
              >
                Add link
              </button>
              <button
                type="button"
                onClick={() => setAddPanelOpen(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <FolderSidebar
          activeFolder={activeFolder}
          setActiveFolder={setActiveFolder}
          isTrashActive={isTrashView}
          trashCount={trashCount}
          onSelectTrash={() => setActiveFolder("trash")}
          folderChildrenMap={folderChildrenMap}
          folderOptions={folderOptions}
          links={launcher.links}
          linksByFolder={linksByFolder}
          newFolderName={newFolderName}
          setNewFolderName={setNewFolderName}
          newFolderParentId={newFolderParentId}
          setNewFolderParentId={setNewFolderParentId}
          addFolder={addFolder}
          editingFolderId={editingFolderId}
          editFolderName={editFolderName}
          setEditFolderName={setEditFolderName}
          editFolderParentId={editFolderParentId}
          setEditFolderParentId={setEditFolderParentId}
          saveEditedFolder={saveEditedFolder}
          cancelEditFolder={cancelEditFolder}
          startEditFolder={startEditFolder}
          deleteFolder={deleteFolder}
          moveFolder={moveFolder}
          moveLink={moveLink}
        />

        <main className="min-w-0 flex-1 overflow-y-auto p-4">
          {isTrashView ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    Trash
                  </h2>
                  <p className="text-xs text-slate-500">
                    Restore items or permanently delete them.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={emptyTrash}
                  disabled={trashCount === 0}
                  className="rounded-lg border border-rose-500/50 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:border-rose-400 hover:text-rose-100 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
                >
                  Empty trash
                </button>
              </div>

              {trashCount === 0 ? (
                <div className="flex h-56 flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800">
                    <Search className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">
                      Trash is empty
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Deleted folders and links show up here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Folders
                    </h3>
                    {trashedFoldersFiltered.length > 0 ? (
                      <div className="space-y-2">
                        {trashedFoldersFiltered.map((folder) => (
                          <div
                            key={folder.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-100">
                                {folder.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                Deleted{" "}
                                {new Date(folder.deletedAt).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  restoreFolderFromTrash(folder.id)
                                }
                                className="rounded-md border border-emerald-500/40 px-2.5 py-1 text-xs text-emerald-200 transition hover:border-emerald-400 hover:text-emerald-100"
                              >
                                Restore
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteFolderFromTrash(folder.id)}
                                className="rounded-md border border-rose-500/40 px-2.5 py-1 text-xs text-rose-200 transition hover:border-rose-400 hover:text-rose-100"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600">
                        No folders match your search.
                      </p>
                    )}
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Links
                    </h3>
                    {trashedLinksFiltered.length > 0 ? (
                      <div className="space-y-2">
                        {trashedLinksFiltered.map((link) => (
                          <div
                            key={link.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-100">
                                {link.title}
                              </p>
                              <p className="text-xs text-slate-500">
                                {link.url}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => restoreLinkFromTrash(link.id)}
                                className="rounded-md border border-emerald-500/40 px-2.5 py-1 text-xs text-emerald-200 transition hover:border-emerald-400 hover:text-emerald-100"
                              >
                                Restore
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteLinkFromTrash(link.id)}
                                className="rounded-md border border-rose-500/40 px-2.5 py-1 text-xs text-rose-200 transition hover:border-rose-400 hover:text-rose-100"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600">
                        No links match your search.
                      </p>
                    )}
                  </section>
                </div>
              )}
            </div>
          ) : filteredLinks.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredLinks.map((link) =>
                editingLinkId === link.id ? (
                  <div key={link.id} className="col-span-full">
                    <EditLinkForm
                      link={link}
                      folderOptions={folderOptions}
                      editTitle={editTitle}
                      editUrl={editUrl}
                      editBadge={editBadge}
                      editFolderId={editFolderId}
                      setEditTitle={setEditTitle}
                      setEditUrl={setEditUrl}
                      setEditBadge={setEditBadge}
                      setEditFolderId={setEditFolderId}
                      onSave={saveEditedLink}
                      onCancel={() => setEditingLinkId(null)}
                    />
                  </div>
                ) : (
                  <LinkCard
                    key={link.id}
                    link={link}
                    folderPath={
                      folderPathById.get(link.folderId) ?? "Unknown folder"
                    }
                    onFavorite={() => toggleFavorite(link.id)}
                    onEdit={() => startEditLink(link)}
                    onRemove={() => removeLink(link.id)}
                  />
                ),
              )}
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800">
                <Search className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-400">
                  No links found
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Try a different search or folder.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddPanelOpen(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-blue-500"
              >
                Add your first link
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
