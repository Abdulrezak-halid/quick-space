import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
} from 'react'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { loadLauncherData, saveLauncherData } from './storage/linkStorage'
import type { Folder, LauncherData, LinkItem } from './types/link'

const normalize = (text: string): string => text.trim().toLowerCase()

const getHostname = (url: string): string => {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

const getFaviconUrl = (url: string): string => {
  const hostname = getHostname(url)
  return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`
}

const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const normalizeUrl = (url: string): string => {
  const cleaned = url.trim()
  if (!cleaned) {
    return cleaned
  }

  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    return cleaned
  }

  return `https://${cleaned}`
}

const openExternal = (url: string): void => {
  window.open(url, '_blank', 'noopener,noreferrer')
}

const isValidLauncherData = (value: unknown): value is LauncherData => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const parsed = value as { folders?: unknown; links?: unknown }

  if (!Array.isArray(parsed.folders) || !Array.isArray(parsed.links)) {
    return false
  }

  const foldersValid = parsed.folders.every((folder) => {
    if (typeof folder !== 'object' || folder === null) {
      return false
    }

    const candidate = folder as {
      id?: unknown
      name?: unknown
      parentId?: unknown
      createdAt?: unknown
    }

    return (
      typeof candidate.id === 'string' &&
      typeof candidate.name === 'string' &&
      typeof candidate.createdAt === 'number' &&
      (typeof candidate.parentId === 'string' || typeof candidate.parentId === 'undefined')
    )
  })

  const linksValid = parsed.links.every((link) => {
    if (typeof link !== 'object' || link === null) {
      return false
    }

    const candidate = link as {
      id?: unknown
      title?: unknown
      url?: unknown
      folderId?: unknown
      description?: unknown
      badge?: unknown
      favorite?: unknown
      createdAt?: unknown
    }

    return (
      typeof candidate.id === 'string' &&
      typeof candidate.title === 'string' &&
      typeof candidate.url === 'string' &&
      typeof candidate.folderId === 'string' &&
      (typeof candidate.description === 'string' || typeof candidate.description === 'undefined') &&
      (typeof candidate.badge === 'string' || typeof candidate.badge === 'undefined') &&
      typeof candidate.favorite === 'boolean' &&
      typeof candidate.createdAt === 'number'
    )
  })

  return foldersValid && linksValid
}

function App() {
  const [launcher, setLauncher] = useState<LauncherData>(() => loadLauncherData())
  const [query, setQuery] = useState('')
  const [activeFolder, setActiveFolder] = useState<string>('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)

  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderParentId, setNewFolderParentId] = useState('')

  const [newLinkTitle, setNewLinkTitle] = useState('')
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [newLinkBadge, setNewLinkBadge] = useState('')
  const [newLinkFolderId, setNewLinkFolderId] = useState(launcher.folders[0]?.id ?? '')

  const [editingLinkId, setEditingLinkId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editBadge, setEditBadge] = useState('')
  const [editFolderId, setEditFolderId] = useState('')

  const searchInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const debouncedQuery = useDebouncedValue(query, 300)

  useEffect(() => {
    saveLauncherData(launcher)
  }, [launcher])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const links = launcher.links
  const folders = launcher.folders

  const folderMap = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders],
  )

  const folderChildrenMap = useMemo(() => {
    const children = new Map<string | undefined, Folder[]>()

    folders.forEach((folder) => {
      const key = folder.parentId
      const list = children.get(key) ?? []
      list.push(folder)
      children.set(key, list)
    })

    children.forEach((list) => {
      list.sort((a, b) => a.name.localeCompare(b.name))
    })

    return children
  }, [folders])

  const folderOptions = useMemo(() => {
    const options: Array<{ id: string; label: string }> = []

    const walk = (parentId: string | undefined, depth: number): void => {
      const children = folderChildrenMap.get(parentId) ?? []
      children.forEach((folder) => {
        options.push({
          id: folder.id,
          label: `${'  '.repeat(depth)}${folder.name}`,
        })
        walk(folder.id, depth + 1)
      })
    }

    walk(undefined, 0)
    return options
  }, [folderChildrenMap])

  const linksByFolder = useMemo(() => {
    const counts: Record<string, number> = {}

    links.forEach((link) => {
      counts[link.folderId] = (counts[link.folderId] ?? 0) + 1
    })

    return counts
  }, [links])

  const folderPathById = useMemo(() => {
    const pathMap = new Map<string, string>()

    const getPath = (folderId: string): string => {
      const existing = pathMap.get(folderId)
      if (existing) {
        return existing
      }

      const folder = folderMap.get(folderId)
      if (!folder) {
        return 'Unknown'
      }

      const path = folder.parentId ? `${getPath(folder.parentId)} / ${folder.name}` : folder.name
      pathMap.set(folderId, path)
      return path
    }

    folders.forEach((folder) => {
      getPath(folder.id)
    })

    return pathMap
  }, [folderMap, folders])

  const activeFolderSet = useMemo(() => {
    if (activeFolder === 'all') {
      return null
    }

    const ids = new Set<string>()

    const walk = (folderId: string): void => {
      ids.add(folderId)
      const children = folderChildrenMap.get(folderId) ?? []
      children.forEach((folder) => walk(folder.id))
    }

    walk(activeFolder)
    return ids
  }, [activeFolder, folderChildrenMap])

  const filteredLinks = useMemo(() => {
    const normalizedQuery = normalize(debouncedQuery)

    return links
      .filter((link) => {
        const searchableText = normalize(
          `${link.title} ${link.badge ?? ''} ${link.url} ${link.description ?? ''}`,
        )

        const folderMatch = activeFolderSet ? activeFolderSet.has(link.folderId) : true
        const favoriteMatch = favoritesOnly ? link.favorite : true
        const searchMatch =
          normalizedQuery.length === 0 || searchableText.includes(normalizedQuery)

        return folderMatch && favoriteMatch && searchMatch
      })
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.title.localeCompare(b.title))
  }, [activeFolderSet, debouncedQuery, favoritesOnly, links])

  const addFolder = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()

    const name = newFolderName.trim()
    if (!name) {
      return
    }

    const parentId = newFolderParentId || undefined

    const folder: Folder = {
      id: createId(),
      name,
      parentId,
      createdAt: Date.now(),
    }

    setLauncher((current) => ({
      ...current,
      folders: [...current.folders, folder],
    }))

    setNewFolderName('')
    setNewFolderParentId('')
    setActiveFolder(folder.id)
    setNewLinkFolderId(folder.id)
  }

  const addLink = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()

    const title = newLinkTitle.trim()
    const url = normalizeUrl(newLinkUrl)

    if (!title || !url || !newLinkFolderId) {
      return
    }

    const link: LinkItem = {
      id: createId(),
      title,
      url,
      folderId: newLinkFolderId,
      badge: newLinkBadge.trim() || undefined,
      favorite: false,
      createdAt: Date.now(),
    }

    setLauncher((current) => ({
      ...current,
      links: [link, ...current.links],
    }))

    setNewLinkTitle('')
    setNewLinkUrl('')
    setNewLinkBadge('')
    setActiveFolder(newLinkFolderId)
  }

  const removeLink = (id: string): void => {
    setLauncher((current) => ({
      ...current,
      links: current.links.filter((link) => link.id !== id),
    }))
  }

  const toggleFavorite = (id: string): void => {
    setLauncher((current) => ({
      ...current,
      links: current.links.map((link) =>
        link.id === id ? { ...link, favorite: !link.favorite } : link,
      ),
    }))
  }

  const startEditLink = (link: LinkItem): void => {
    setEditingLinkId(link.id)
    setEditTitle(link.title)
    setEditUrl(link.url)
    setEditBadge(link.badge ?? '')
    setEditFolderId(link.folderId)
  }

  const saveEditedLink = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()

    if (!editingLinkId) {
      return
    }

    const title = editTitle.trim()
    const url = normalizeUrl(editUrl)

    if (!title || !url || !editFolderId) {
      return
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
    }))

    setEditingLinkId(null)
  }

  const renderFolderTree = (parentId: string | undefined, depth: number): ReactElement[] => {
    const children = folderChildrenMap.get(parentId) ?? []

    return children.flatMap((folder) => {
      const item = (
        <div key={folder.id}>
          <button
            className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
              activeFolder === folder.id
                ? 'border-blue-400 bg-blue-500/15 text-blue-100'
                : 'border-slate-700 bg-slate-800/60 text-slate-200 hover:border-slate-500'
            }`}
            onClick={() => setActiveFolder(folder.id)}
            style={{ marginLeft: depth * 10 }}
            type="button"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{folder.name}</span>
              <span className="text-xs text-slate-400">{linksByFolder[folder.id] ?? 0}</span>
            </div>
          </button>
        </div>
      )

      return [item, ...renderFolderTree(folder.id, depth + 1)]
    })
  }

  const exportAsJson = (): void => {
    const fileName = `quickspace-export-${new Date().toISOString().slice(0, 10)}.json`
    const content = JSON.stringify(launcher, null, 2)
    const blob = new Blob([content], { type: 'application/json' })
    const objectUrl = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = objectUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()

    URL.revokeObjectURL(objectUrl)
  }

  const triggerImport = (): void => {
    importInputRef.current?.click()
  }

  const importFromJson = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw) as unknown

      if (!isValidLauncherData(parsed)) {
        alert('Invalid JSON format for QuickSpace import.')
        return
      }

      setLauncher(parsed)
      setActiveFolder('all')
      setNewLinkFolderId(parsed.folders[0]?.id ?? '')
      alert('Import completed successfully.')
    } catch {
      alert('Failed to import JSON file.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1240px] flex-col gap-4 p-4 md:p-6 lg:flex-row lg:gap-6">
        <aside className="w-full rounded-2xl border border-slate-800 bg-slate-900/75 p-4 lg:w-96">
          <h1 className="text-xl font-semibold">QuickSpace</h1>
          <p className="mt-1 text-sm text-slate-400">Folders and links, like your Chrome bookmarks.</p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500"
              onClick={exportAsJson}
              type="button"
            >
              Export JSON
            </button>
            <button
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500"
              onClick={triggerImport}
              type="button"
            >
              Import JSON
            </button>
          </div>
          <input
            accept="application/json,.json"
            className="hidden"
            onChange={importFromJson}
            ref={importInputRef}
            type="file"
          />

          <div className="mt-6 space-y-2">
            <button
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                activeFolder === 'all'
                  ? 'border-blue-400 bg-blue-500/15 text-blue-100'
                  : 'border-slate-700 bg-slate-800/60 text-slate-200 hover:border-slate-500'
              }`}
              onClick={() => setActiveFolder('all')}
              type="button"
            >
              All Links ({links.length})
            </button>

            {renderFolderTree(undefined, 0)}
          </div>

          <form className="mt-6 space-y-2 border-t border-slate-800 pt-4" onSubmit={addFolder}>
            <label className="text-xs uppercase tracking-[0.18em] text-slate-400">Add Folder</label>
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-400"
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="Folder name"
              type="text"
              value={newFolderName}
            />
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-400"
              onChange={(event) => setNewFolderParentId(event.target.value)}
              value={newFolderParentId}
            >
              <option value="">Top level</option>
              {folderOptions.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.label}
                </option>
              ))}
            </select>
            <button className="w-full rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-400" type="submit">
              Add Folder
            </button>
          </form>

          <form className="mt-4 space-y-2" onSubmit={addLink}>
            <label className="text-xs uppercase tracking-[0.18em] text-slate-400">Add Link</label>
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-400"
              onChange={(event) => setNewLinkTitle(event.target.value)}
              placeholder="Title"
              type="text"
              value={newLinkTitle}
            />
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-400"
              onChange={(event) => setNewLinkUrl(event.target.value)}
              placeholder="https://example.com"
              type="text"
              value={newLinkUrl}
            />
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-400"
              onChange={(event) => setNewLinkBadge(event.target.value)}
              placeholder="Badge (e.g. Docs, AI, Tool)"
              type="text"
              value={newLinkBadge}
            />
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-400"
              onChange={(event) => setNewLinkFolderId(event.target.value)}
              value={newLinkFolderId}
            >
              {folderOptions.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.label}
                </option>
              ))}
            </select>
            <button className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-white" type="submit">
              Add Link
            </button>
          </form>
        </aside>

        <main className="flex-1 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 md:p-5">
          <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Your Links</h2>
              <p className="text-sm text-slate-400">Edit links, add badges, and launch quickly.</p>
            </div>

            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
              <label className="relative block w-full md:w-[380px]">
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && filteredLinks.length > 0) {
                      event.preventDefault()
                      openExternal(filteredLinks[0].url)
                    }
                  }}
                  placeholder="Search title, badge, or URL..."
                  ref={searchInputRef}
                  type="text"
                  value={query}
                />
                <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-slate-500">Ctrl + K</span>
              </label>

              <button
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  favoritesOnly
                    ? 'border-amber-400 bg-amber-500/15 text-amber-100'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                }`}
                onClick={() => setFavoritesOnly((current) => !current)}
                type="button"
              >
                Favorites only
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {filteredLinks.length > 0 ? (
              filteredLinks.map((link) => (
                <article
                  className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                  key={link.id}
                >
                  {editingLinkId === link.id ? (
                    <form className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={saveEditedLink}>
                      <input
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-400"
                        onChange={(event) => setEditTitle(event.target.value)}
                        placeholder="Title"
                        type="text"
                        value={editTitle}
                      />
                      <input
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-400"
                        onChange={(event) => setEditUrl(event.target.value)}
                        placeholder="URL"
                        type="text"
                        value={editUrl}
                      />
                      <div className="flex gap-2">
                        <input
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-400"
                          onChange={(event) => setEditBadge(event.target.value)}
                          placeholder="Badge"
                          type="text"
                          value={editBadge}
                        />
                        <select
                          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-400"
                          onChange={(event) => setEditFolderId(event.target.value)}
                          value={editFolderId}
                        >
                          {folderOptions.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-400"
                          type="submit"
                        >
                          Save
                        </button>
                        <button
                          className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:border-slate-400"
                          onClick={() => setEditingLinkId(null)}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <img
                            alt=""
                            className="h-5 w-5 shrink-0 rounded"
                            loading="lazy"
                            src={getFaviconUrl(link.url)}
                          />
                          <p className="truncate text-base font-medium text-slate-100">{link.title}</p>
                          {link.badge && (
                            <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-200">
                              {link.badge}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-sm text-slate-400">{getHostname(link.url)}</p>
                        <p className="truncate text-xs text-slate-500">{folderPathById.get(link.folderId) ?? 'Unknown folder'}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          aria-label={link.favorite ? `Unfavorite ${link.title}` : `Favorite ${link.title}`}
                          className={`rounded-md border px-2 py-1 text-sm transition ${
                            link.favorite
                              ? 'border-amber-400 bg-amber-500/15 text-amber-200'
                              : 'border-slate-700 text-slate-400 hover:text-slate-100'
                          }`}
                          onClick={() => toggleFavorite(link.id)}
                          type="button"
                        >
                          {link.favorite ? 'Starred' : 'Star'}
                        </button>

                        <button
                          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500"
                          onClick={() => startEditLink(link)}
                          type="button"
                        >
                          Edit
                        </button>

                        <button
                          className="rounded-md bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-400"
                          onClick={() => openExternal(link.url)}
                          type="button"
                        >
                          Open
                        </button>

                        <button
                          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:border-rose-400 hover:text-rose-200"
                          onClick={() => removeLink(link.id)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))
            ) : (
              <p className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-6 text-sm text-slate-400">
                No links found for this filter.
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
