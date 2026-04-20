export type Folder = {
  id: string
  name: string
  parentId?: string
  createdAt: number
}

export type LinkItem = {
  id: string
  title: string
  url: string
  folderId: string
  description?: string
  badge?: string
  favorite: boolean
  createdAt: number
}

export type LauncherData = {
  folders: Folder[]
  links: LinkItem[]
}
