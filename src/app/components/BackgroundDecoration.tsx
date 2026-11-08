import backgroundImage from '../../background.png';

export function BackgroundDecoration() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0 bg-[#05030a]" />
      <img
        src={backgroundImage}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        aria-hidden="true"
      />
    </div>
  );
}
