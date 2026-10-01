'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileText,
  ImageIcon,
  Video,
  Search,
  RefreshCw,
  Loader2,
  ExternalLink,
  Check,
  FolderOpen,
} from 'lucide-react';
import {
  listAccountMedia,
  AccountMediaItem,
} from '@/lib/storage/upload-media';

interface MediaLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaType: 'image' | 'video' | 'document' | 'all';
  onSelect: (item: AccountMediaItem) => void;
  selectedUrl?: string;
}

const EXTENSIONS_BY_TYPE: Record<'image' | 'video' | 'document' | 'all', string[]> = {
  document: ['pdf'],
  image: ['jpg', 'jpeg', 'png', 'webp'],
  video: ['mp4', '3gp', 'mov'],
  all: [],
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export function MediaLibraryDialog({
  open,
  onOpenChange,
  mediaType,
  onSelect,
  selectedUrl,
}: MediaLibraryDialogProps) {
  const [items, setItems] = useState<AccountMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const filterExts = useMemo(
    () => EXTENSIONS_BY_TYPE[mediaType] ?? [],
    [mediaType],
  );

  async function loadMedia() {
    setLoading(true);
    try {
      const files = await listAccountMedia('chat-media', filterExts);
      setItems(files);
    } catch (err) {
      console.error('Failed to load media files:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      void loadMedia();
      setSearch('');
    }
  }, [open, mediaType]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, search]);

  function getMediaIcon(ext: string) {
    if (ext === 'pdf') {
      return <FileText className="h-5 w-5 text-red-500 shrink-0" />;
    }
    if (['mp4', '3gp', 'mov'].includes(ext)) {
      return <Video className="h-5 w-5 text-blue-500 shrink-0" />;
    }
    return <ImageIcon className="h-5 w-5 text-emerald-500 shrink-0" />;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card sm:max-w-xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FolderOpen className="h-5 w-5 text-primary" />
            Media Library
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Select a previously uploaded {mediaType === 'all' ? 'file' : mediaType} to avoid duplicate storage and save bandwidth.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${mediaType === 'all' ? 'files' : `${mediaType}s`}…`}
              className="pl-9 bg-muted border-border text-foreground text-xs h-9"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadMedia}
            disabled={loading}
            className="h-9 px-2.5"
            title="Refresh list"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto mt-3 border border-border rounded-lg divide-y divide-border/60 min-h-[240px] max-h-[380px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs">Loading uploaded files…</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center px-4 text-muted-foreground">
              <FolderOpen className="h-10 w-10 text-muted-foreground/40 mb-2" />
              <p className="text-xs font-medium text-foreground">No files found</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs">
                {search
                  ? 'No uploaded files matched your search.'
                  : `You haven't uploaded any ${mediaType === 'all' ? 'media' : mediaType} files yet.`}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = selectedUrl === item.publicUrl;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 transition-colors hover:bg-muted/50 cursor-pointer ${
                    isSelected ? 'bg-primary/5 border-l-2 border-primary' : ''
                  }`}
                  onClick={() => {
                    onSelect(item);
                    onOpenChange(false);
                  }}
                >
                  <div className="flex items-center gap-3 overflow-hidden mr-3">
                    {item.ext === 'jpg' || item.ext === 'jpeg' || item.ext === 'png' || item.ext === 'webp' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.publicUrl}
                        alt=""
                        className="h-9 w-9 rounded object-cover border border-border shrink-0 bg-muted"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded flex items-center justify-center bg-muted border border-border shrink-0">
                        {getMediaIcon(item.ext)}
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <p className="text-xs font-medium text-foreground truncate max-w-xs sm:max-w-sm" title={item.name}>
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        {item.size > 0 && <span>{formatBytes(item.size)}</span>}
                        {item.size > 0 && item.createdAt && <span>•</span>}
                        {item.createdAt && <span>{formatDate(item.createdAt)}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={item.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-foreground p-1"
                      title="Preview in new tab"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <Button
                      type="button"
                      size="sm"
                      variant={isSelected ? 'default' : 'outline'}
                      className="h-7 text-xs px-2.5"
                    >
                      {isSelected ? (
                        <>
                          <Check className="h-3 w-3 mr-1" /> Selected
                        </>
                      ) : (
                        'Select'
                      )}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
