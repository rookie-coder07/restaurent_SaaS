export default function AudioPlayer({ src, className = '' }) {
  if (!src) {
    return null;
  }

  return (
    <audio controls className={`w-full rounded-xl ${className}`}>
      <source src={src} />
      Your browser does not support the audio element.
    </audio>
  );
}
