import { FileText, Download, Eye, Trash2, Edit, Image as ImageIcon, FileCode, Film, Music, File } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRef } from 'react'


interface FileCardProps {
  filename: string
  size: string
  type: string
  lastModified: string
  onView?: () => void
  onEdit?: () => void
  onDownload?: () => void
  onDelete?: () => void
}

export function FileCard({
  filename,
  size,
  type,
  lastModified,
  onView,
  onEdit,
  onDownload,
  onDelete,
}: FileCardProps) {
  const getFileIcon = () => {
    const iconClass = "h-8 w-8 text-[rgb(var(--accent-rgb))]"
    if (type.includes('image')) return <ImageIcon className={iconClass} />
    if (type.includes('pdf')) return <FileText className={iconClass} />
    if (type.includes('video')) return <Film className={iconClass} />
    if (type.includes('audio')) return <Music className={iconClass} />
    if (type.includes('code') || type.includes('text')) return <FileCode className={iconClass} />
    return <File className={iconClass} />
  }

  return (
    <div className="glass-card rounded-xl p-4 group">
      <div className="flex items-start gap-4">
        {/* File Icon */}
        <div className="flex-shrink-0 text-4xl">
          {getFileIcon()}
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate mb-1">
            {filename}
          </h3>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
            <span className="whitespace-nowrap">{size}</span>
            <span className="opacity-30">•</span>
            <span className="truncate max-w-[150px]" title={type}>{type}</span>
            <span className="opacity-30">•</span>
            <span className="whitespace-nowrap">{lastModified}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 overflow-hidden">
        {onView && (
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 glass-hover h-8 px-2 min-w-0"
            onClick={onView}
          >
            <Eye className="h-3 w-3 mr-1 flex-shrink-0" />
            <span className="text-[10px] truncate">View</span>
          </Button>
        )}

        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 glass-hover h-8 px-2 min-w-0"
            onClick={onEdit}
          >
            <Edit className="h-3 w-3 mr-1 flex-shrink-0" />
            <span className="text-[10px] truncate">Edit</span>
          </Button>
        )}

        {onDownload && (
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 glass-hover h-8 px-2 min-w-0"
            onClick={onDownload}
          >
            <Download className="h-3 w-3 mr-1 flex-shrink-0" />
            <span className="text-[10px] truncate">Download</span>
          </Button>
        )}

        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 glass-hover h-8 px-2 min-w-0 text-red-400 hover:text-red-500 hover:bg-red-500/10"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3 mr-1 flex-shrink-0" />
            <span className="text-[10px] truncate">Delete</span>
          </Button>
        )}
      </div>
    </div>
  )
}

interface FileGridProps {
  files: Array<{
    id: string
    filename: string
    size: string
    type: string
    lastModified: string
  }>
  onFileAction?: (fileId: string, action: 'view' | 'edit' | 'download' | 'delete') => void
}

export function FileGrid({ files, onFileAction, onUpload }: FileGridProps & { onUpload?: (file: File) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Your Library</h3>
          <p className="text-xs text-muted-foreground mt-1">Files in this list are used as AI context.</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            accept=".txt,.md,.pdf,.docx"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onUpload?.(file)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="glass-hover border-white/10"
          >
            <Download className="h-4 w-4 mr-2" />
            Add to Knowledge
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {files.map((file) => (
          <FileCard
            key={file.id}
            filename={file.filename}
            size={file.size}
            type={file.type}
            lastModified={file.lastModified}
            onView={() => onFileAction?.(file.id, 'view')}
            onEdit={() => onFileAction?.(file.id, 'edit')}
            onDownload={() => onFileAction?.(file.id, 'download')}
            onDelete={() => onFileAction?.(file.id, 'delete')}
          />
        ))}

        {files.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
            <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Knowledge Base Empty</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Upload documents here to give your assistant permanent knowledge.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
