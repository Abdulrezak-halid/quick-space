const fs = require("fs");

// PATCH APP.TSX
let app = fs.readFileSync("src/App.tsx", "utf8");

if (!app.includes("moveFolder")) {
  app = app.replace(
    /const deleteFolder = \([^\}]+\};/s,
    `$&

  const moveFolder = (folderId: string, newParentId: string | undefined): void => {
    if (folderId === newParentId) return;
    const descendantIds = new Set<string>();
    const collectDescendants = (id: string): void => {
      descendantIds.add(id);
      (folderChildrenMap.get(id) ?? []).forEach((c) => collectDescendants(c.id));
    };
    collectDescendants(folderId);
    if (newParentId && descendantIds.has(newParentId)) {
      alert("Cannot move a folder inside itself or its descendants.");
      return;
    }
    setLauncher((current) => ({
      ...current,
      folders: current.folders.map(f => f.id === folderId ? { ...f, parentId: newParentId } : f)
    }));
  };

  const moveLink = (linkId: string, newFolderId: string): void => {
    setLauncher((current) => ({
      ...current,
      links: current.links.map(l => l.id === linkId ? { ...l, folderId: newFolderId } : l)
    }));
  };`,
  );

  app = app.replace(
    "deleteFolder={deleteFolder}",
    "deleteFolder={deleteFolder}\n          moveFolder={moveFolder}\n          moveLink={moveLink}",
  );

  fs.writeFileSync("src/App.tsx", app);
}
