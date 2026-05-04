import { DEFAULT_FOLDERS, DEFAULT_LINKS } from "../data/defaultLinks";
import { IMPORTED_FOLDERS, IMPORTED_LINKS } from "../data/importedBookmarks";
import type { Folder, LauncherData, LinkItem } from "../types/link";

const STORAGE_KEY = "quick-space.launcher.v1";
const BOOKMARKS_IMPORTED_KEY = "quick-space.bookmarks.imported";

type LegacyLink = {
  id: string;
  title: string;
  url: string;
  category?: string;
  favorite?: boolean;
  createdAt?: number;
  description?: string;
  badge?: string;
};

const now = (): number => Date.now();

const mergeLauncherData = (stored: LauncherData): LauncherData => {
  const folderMap = new Map<string, Folder>(
    [...DEFAULT_FOLDERS, ...stored.folders].map((folder) => [
      folder.id,
      folder,
    ]),
  );
  const linkMap = new Map<string, LinkItem>(
    [...DEFAULT_LINKS, ...stored.links].map((link) => [link.id, link]),
  );

  const firstFolderId = DEFAULT_FOLDERS[0]?.id ?? "general";
  const rawFolders = Array.from(folderMap.values());
  const rawFolderIds = new Set(rawFolders.map((folder) => folder.id));
  const folders = rawFolders.map((folder) => ({
    ...folder,
    parentId:
      folder.parentId &&
      rawFolderIds.has(folder.parentId) &&
      folder.parentId !== folder.id
        ? folder.parentId
        : undefined,
  }));
  const folderIds = new Set(folders.map((folder) => folder.id));

  const links = Array.from(linkMap.values()).map((link) => ({
    ...link,
    folderId: folderIds.has(link.folderId) ? link.folderId : firstFolderId,
  }));

  return { folders, links };
};

const migrateLegacyLinks = (legacyLinks: LegacyLink[]): LauncherData => {
  const links: LinkItem[] = legacyLinks.map((item, index) => ({
    id: item.id || `legacy-${index}-${now()}`,
    title: item.title,
    url: item.url,
    folderId: item.category || DEFAULT_FOLDERS[0]?.id || "general",
    favorite: Boolean(item.favorite),
    createdAt: item.createdAt || now(),
    description: item.description,
    badge: item.badge,
  }));

  return mergeLauncherData({ folders: DEFAULT_FOLDERS, links });
};

export const loadLauncherData = (): LauncherData => {
  if (typeof window === "undefined") {
    return { folders: DEFAULT_FOLDERS, links: DEFAULT_LINKS };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  const bookmarksImported = window.localStorage.getItem(BOOKMARKS_IMPORTED_KEY);

  // Always merge imported bookmarks if not already done
  let currentData: LauncherData;

  if (!raw) {
    currentData = { folders: DEFAULT_FOLDERS, links: DEFAULT_LINKS };
  } else {
    try {
      const parsed = JSON.parse(raw) as unknown;

      if (Array.isArray(parsed)) {
        currentData = migrateLegacyLinks(parsed as LegacyLink[]);
      } else if (
        typeof parsed === "object" &&
        parsed !== null &&
        Array.isArray((parsed as LauncherData).folders) &&
        Array.isArray((parsed as LauncherData).links)
      ) {
        currentData = mergeLauncherData(parsed as LauncherData);
      } else {
        currentData = { folders: DEFAULT_FOLDERS, links: DEFAULT_LINKS };
      }
    } catch {
      currentData = { folders: DEFAULT_FOLDERS, links: DEFAULT_LINKS };
    }
  }

  // Merge imported bookmarks on first import
  if (!bookmarksImported) {
    currentData = mergeLauncherData({
      folders: [...currentData.folders, ...IMPORTED_FOLDERS],
      links: [...currentData.links, ...IMPORTED_LINKS],
    });
    window.localStorage.setItem(BOOKMARKS_IMPORTED_KEY, "true");
    saveLauncherData(currentData);
  }

  return currentData;
};

export const saveLauncherData = (data: LauncherData): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};
