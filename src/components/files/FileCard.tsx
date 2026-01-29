import { FileText, Download, Eye, Trash2, Edit } from 'lucide-react'
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
    if (type.includes('image')) return '🖼️'
    if (type.includes('pdf')) return '📄'
    if (type.includes('video')) return '🎥'
    if (type.includes('audio')) return '🎵'
    if (type.includes('code') || type.includes('text')) return '💾'
    return '📁'
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
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>{size}</span>
            <span>•</span>
            <span>{type}</span>
            <span>•</span>
            <span>{lastModified}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {onView && (
          <Button
            variant="ghost"
            size="sm"
            className="glass-hover flex-1 min-w-[70px] h-8 px-2"
            onClick={onView}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            <span className="text-[10px]">View</span>
          </Button>
        )}

        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="glass-hover flex-1 min-w-[70px] h-8 px-2"
            onClick={onEdit}
          >
            <Edit className="h-3.5 w-3.5 mr-1" />
            <span className="text-[10px]">Edit</span>
          </Button>
        )}

        {onDownload && (
          <Button
            variant="ghost"
            size="sm"
            className="glass-hover flex-1 min-w-[85px] h-8 px-2"
            onClick={onDownload}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            <span className="text-[10px]">Download</span>
          </Button>
        )}

        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="glass-hover flex-1 min-w-[75px] h-8 px-2 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            <span className="text-[10px]">Delete</span>
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
