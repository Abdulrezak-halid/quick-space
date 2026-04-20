import { DEFAULT_FOLDERS, DEFAULT_LINKS } from '../data/defaultLinks'
import type { Folder, LauncherData, LinkItem } from '../types/link'

const STORAGE_KEY = 'quick-space.launcher.v1'

type LegacyLink = {
  id: string
  title: string
  url: string
  category?: string
  favorite?: boolean
  createdAt?: number
  description?: string
  badge?: string
}

const now = (): number => Date.now()

const mergeLauncherData = (stored: LauncherData): LauncherData => {
  const folderMap = new Map<string, Folder>(
    [...DEFAULT_FOLDERS, ...stored.folders].map((folder) => [folder.id, folder]),
  )
  const linkMap = new Map<string, LinkItem>(
    [...DEFAULT_LINKS, ...stored.links].map((link) => [link.id, link]),
  )

  const firstFolderId = DEFAULT_FOLDERS[0]?.id ?? 'general'
  const rawFolders = Array.from(folderMap.values())
  const rawFolderIds = new Set(rawFolders.map((folder) => folder.id))
  const folders = rawFolders.map((folder) => ({
    ...folder,
    parentId:
      folder.parentId && rawFolderIds.has(folder.parentId) && folder.parentId !== folder.id
        ? folder.parentId
        : undefined,
  }))
  const folderIds = new Set(folders.map((folder) => folder.id))

  const links = Array.from(linkMap.values()).map((link) => ({
    ...link,
    folderId: folderIds.has(link.folderId) ? link.folderId : firstFolderId,
  }))

  return { folders, links }
}

const migrateLegacyLinks = (legacyLinks: LegacyLink[]): LauncherData => {
  const links: LinkItem[] = legacyLinks.map((item, index) => ({
    id: item.id || `legacy-${index}-${now()}`,
    title: item.title,
    url: item.url,
    folderId: item.category || DEFAULT_FOLDERS[0]?.id || 'general',
    favorite: Boolean(item.favorite),
    createdAt: item.createdAt || now(),
    description: item.description,
    badge: item.badge,
  }))

  return mergeLauncherData({ folders: DEFAULT_FOLDERS, links })
}

export const loadLauncherData = (): LauncherData => {
  if (typeof window === 'undefined') {
    return { folders: DEFAULT_FOLDERS, links: DEFAULT_LINKS }
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return { folders: DEFAULT_FOLDERS, links: DEFAULT_LINKS }
  }

  try {
    const parsed = JSON.parse(raw) as unknown

    if (Array.isArray(parsed)) {
      return migrateLegacyLinks(parsed as LegacyLink[])
    }

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Array.isArray((parsed as LauncherData).folders) &&
      Array.isArray((parsed as LauncherData).links)
    ) {
      return mergeLauncherData(parsed as LauncherData)
    }

    return { folders: DEFAULT_FOLDERS, links: DEFAULT_LINKS }
  } catch {
    return { folders: DEFAULT_FOLDERS, links: DEFAULT_LINKS }
  }
}

export const saveLauncherData = (data: LauncherData): void => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
