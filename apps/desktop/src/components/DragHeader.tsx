interface DragHeaderProps {
  children?: React.ReactNode
  className?: string
}

const DragHeader: React.FC<DragHeaderProps> = ({ children, className = "" }) => {
  return (
    <div className={`drag-region h-8 w-full flex items-center ${className}`}>
      <div className="no-drag flex-1">
        {children}
      </div>
    </div>
  )
}

export default DragHeader 