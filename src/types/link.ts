export type Folder = {
  id: string;
  name: string;
  parentId?: string;
  order?: number;
  createdAt: number;
};

export type TrashedFolder = Folder & {
  deletedAt: number;
};

export type LinkItem = {
  id: string;
  title: string;
  url: string;
  folderId: string;
  description?: string;
  badge?: string;
  favorite: boolean;
  createdAt: number;
};

export type TrashedLink = LinkItem & {
  deletedAt: number;
};

export type LauncherData = {
  folders: Folder[];
  links: LinkItem[];
  trashedFolders: TrashedFolder[];
  trashedLinks: TrashedLink[];
};
