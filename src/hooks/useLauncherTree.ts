import { useMemo } from "react";
import type { Folder, LauncherData } from "../types/link";

const normalize = (text: string): string => text.trim().toLowerCase();

export const useLauncherTree = (
  launcher: LauncherData,
  debouncedQuery: string,
  activeFolder: string,
  favoritesOnly: boolean,
) => {
  const folderMap = useMemo(
    () => new Map(launcher.folders.map((folder) => [folder.id, folder])),
    [launcher.folders],
  );

  const folderChildrenMap = useMemo(() => {
    const children = new Map<string | undefined, Folder[]>();

    launcher.folders.forEach((folder) => {
      const list = children.get(folder.parentId) ?? [];
      list.push(folder);
      children.set(folder.parentId, list);
    });

    children.forEach((list) =>
      list.sort(
        (a, b) =>
          (a.order ?? a.createdAt) - (b.order ?? b.createdAt) ||
          a.name.localeCompare(b.name),
      ),
    );
    return children;
  }, [launcher.folders]);

  const folderOptions = useMemo(() => {
    const options: Array<{ id: string; label: string }> = [];

    const walk = (parentId: string | undefined, depth: number): void => {
      (folderChildrenMap.get(parentId) ?? []).forEach((folder) => {
        options.push({
          id: folder.id,
          label: `${"  ".repeat(depth)}${folder.name}`,
        });
        walk(folder.id, depth + 1);
      });
    };

    walk(undefined, 0);
    return options;
  }, [folderChildrenMap]);

  const flatFolders = useMemo(() => {
    const result: Array<Folder & { depth: number }> = [];

    const walk = (parentId: string | undefined, depth: number): void => {
      (folderChildrenMap.get(parentId) ?? []).forEach((folder) => {
        result.push({ ...folder, depth });
        walk(folder.id, depth + 1);
      });
    };

    walk(undefined, 0);
    return result;
  }, [folderChildrenMap]);

  const linksByFolder = useMemo(() => {
    const counts: Record<string, number> = {};

    launcher.links.forEach((link) => {
      counts[link.folderId] = (counts[link.folderId] ?? 0) + 1;
    });

    return counts;
  }, [launcher.links]);

  const folderPathById = useMemo(() => {
    const pathMap = new Map<string, string>();

    const getPath = (folderId: string): string => {
      const existing = pathMap.get(folderId);
      if (existing) {
        return existing;
      }

      const folder = folderMap.get(folderId);
      if (!folder) {
        return "Unknown";
      }

      const path = folder.parentId
        ? `${getPath(folder.parentId)} / ${folder.name}`
        : folder.name;
      pathMap.set(folderId, path);
      return path;
    };

    launcher.folders.forEach((folder) => getPath(folder.id));
    return pathMap;
  }, [folderMap, launcher.folders]);

  const activeFolderSet = useMemo(() => {
    if (activeFolder === "all") {
      return null;
    }

    const ids = new Set<string>();

    const walk = (folderId: string): void => {
      ids.add(folderId);
      (folderChildrenMap.get(folderId) ?? []).forEach((folder) =>
        walk(folder.id),
      );
    };

    walk(activeFolder);
    return ids;
  }, [activeFolder, folderChildrenMap]);

  const filteredLinks = useMemo(() => {
    const normalizedQuery = normalize(debouncedQuery);

    return launcher.links
      .filter((link) => {
        const searchText = normalize(
          `${link.title} ${link.badge ?? ""} ${link.url} ${link.description ?? ""}`,
        );

        const folderMatch = activeFolderSet
          ? activeFolderSet.has(link.folderId)
          : true;
        const favoriteMatch = favoritesOnly ? link.favorite : true;
        const searchMatch =
          normalizedQuery.length === 0 || searchText.includes(normalizedQuery);

        return folderMatch && favoriteMatch && searchMatch;
      })
      .sort(
        (a, b) =>
          Number(b.favorite) - Number(a.favorite) ||
          a.title.localeCompare(b.title),
      );
  }, [activeFolderSet, debouncedQuery, favoritesOnly, launcher.links]);

  const activeFolderName =
    activeFolder === "all"
      ? "All Links"
      : (folderMap.get(activeFolder)?.name ?? "Links");

  return {
    folderMap,
    folderChildrenMap,
    folderOptions,
    folderPathById,
    flatFolders,
    linksByFolder,
    filteredLinks,
    activeFolderName,
  };
};
