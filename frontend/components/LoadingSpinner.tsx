type LoadingSpinnerProps = {
  message?: string;
  className?: string;
};

export default function LoadingSpinner({
  message = 'Loading…',
  className = '',
}: LoadingSpinnerProps) {
  return (
    <div className={`flex justify-center items-center py-12 ${className}`.trim()}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600" />
      <span className="ml-3 text-gray-400">{message}</span>
    </div>
  );
}
