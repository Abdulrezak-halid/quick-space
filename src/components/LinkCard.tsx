import { useState } from "react";

const getHostname = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const getFaviconUrl = (url: string): string => {
  const hostname = getHostname(url);
  return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
};

const openExternal = (url: string): void => {
  window.open(url, "_blank", "noopener,noreferrer");
};

type LinkCardProps = {
  link: {
    id: string;
    title: string;
    url: string;
    badge?: string;
    favorite: boolean;
  };
  folderPath: string;
  onFavorite: () => void;
  onEdit: () => void;
  onRemove: () => void;
};

export const LinkCard = ({
  link,
  folderPath,
  onFavorite,
  onEdit,
  onRemove,
}: LinkCardProps) => {
  const [imgError, setImgError] = useState(false);

  return (
    <article
      className="group cursor-pointer rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-slate-600 hover:bg-slate-900"
      onClick={() => openExternal(link.url)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("type", "link");
        e.dataTransfer.setData("id", link.id);
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
          {!imgError ? (
            <img
              src={getFaviconUrl(link.url)}
              alt=""
              className="h-5 w-5 object-contain"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="text-xs font-semibold uppercase text-slate-400">
              {link.title[0]}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium leading-5 text-slate-100">
              {link.title}
            </p>
            {link.badge && (
              <span className="shrink-0 rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-sky-300">
                {link.badge}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {getHostname(link.url)}
          </p>
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onFavorite();
          }}
          className={`shrink-0 rounded-md p-1.5 transition ${
            link.favorite
              ? "text-amber-400"
              : "text-slate-600 opacity-0 group-hover:opacity-100 hover:text-amber-400"
          }`}
          aria-label={link.favorite ? "Unstar" : "Star"}
        >
          ★
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-slate-600">
          {folderPath}
        </span>

        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-500 transition hover:border-rose-500/60 hover:text-rose-300"
          >
            Remove
          </button>
        </div>
      </div>
    </article>
  );
};