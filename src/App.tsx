import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Download, Plus, Search, Star, Upload } from "lucide-react";
import { EditLinkForm } from "./components/EditLinkForm";
import { FolderSidebar } from "./components/FolderSidebar";
import { LinkCard } from "./components/LinkCard";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { useKeyboardShortcut } from "./hooks/useKeyboardShortcut";
import { useLauncherTree } from "./hooks/useLauncherTree";
import { loadLauncherData, saveLauncherData } from "./storage/linkStorage";
import type { Folder, LauncherData, LinkItem } from "./types/link";

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
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const isValidLauncherData = (value: unknown): value is LauncherData => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const parsed = value as { folders?: unknown; links?: unknown };
  return Array.isArray(parsed.folders) && Array.isArray(parsed.links);
};

function App() {
  const [launcher, setLauncher] = useState<LauncherData>(() => loadLauncherData());
  const [query, setQuery] = useState("");
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);

  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState("");

  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkBadge, setNewLinkBadge] = useState("");
  const [newLinkFolderId, setNewLinkFolderId] = useState(launcher.folders[0]?.id ?? "");

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

  const {
    folderMap,
    folderChildrenMap,
    folderOptions,
    folderPathById,
    linksByFolder,
    filteredLinks,
    activeFolderName,
  } = useLauncherTree(launcher, debouncedQuery, activeFolder, favoritesOnly);

  const addFolder = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const name = newFolderName.trim();
    if (!name) {
      return;
    }

    const folder: Folder = {
      id: createId(),
      name,
      parentId: newFolderParentId || undefined,
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
      (folderChildrenMap.get(folderId) ?? []).forEach((child) => collectDescendants(child.id));
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

  const deleteFolder = (folderId: string): void => {
    const allIds = new Set<string>();

    const collect = (id: string): void => {
      allIds.add(id);
      (folderChildrenMap.get(id) ?? []).forEach((child) => collect(child.id));
    };

    collect(folderId);

    const folderName = folderMap.get(folderId)?.name ?? "this folder";
    const subfolderCount = allIds.size - 1;
    const affectedLinks = launcher.links.filter((link) => allIds.has(link.folderId)).length;

    const confirmMessage =
      affectedLinks > 0
        ? `Delete "${folderName}"${subfolderCount > 0 ? ` and ${subfolderCount} subfolder(s)` : ""}? This will also remove ${affectedLinks} link(s) inside. This cannot be undone.`
        : `Delete "${folderName}"${subfolderCount > 0 ? ` and ${subfolderCount} subfolder(s)` : ""}? This cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setLauncher((current) => ({
      folders: current.folders.filter((folder) => !allIds.has(folder.id)),
      links: current.links.filter((link) => !allIds.has(link.folderId)),
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
    setLauncher((current) => ({
      ...current,
      links: current.links.filter((link) => link.id !== id),
    }));
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

  const importFromJson = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
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

      setLauncher(parsed);
      setActiveFolder("all");
      setNewLinkFolderId(parsed.folders[0]?.id ?? "");
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
          <h1 className="text-sm font-semibold tracking-tight text-slate-100">QuickSpace</h1>
          <span className="text-xs text-slate-500">
            {filteredLinks.length} link{filteredLinks.length !== 1 ? "s" : ""}
            {activeFolder !== "all" && ` in ${activeFolderName}`}
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
                window.open(filteredLinks[0].url, "_blank", "noopener,noreferrer");
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
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">New link</p>
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
              <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500">
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
        />

        <main className="min-w-0 flex-1 overflow-y-auto p-4">
          {filteredLinks.length > 0 ? (
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
                    folderPath={folderPathById.get(link.folderId) ?? "Unknown folder"}
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
                <p className="text-sm font-medium text-slate-400">No links found</p>
                <p className="mt-1 text-xs text-slate-600">Try a different search or folder.</p>
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