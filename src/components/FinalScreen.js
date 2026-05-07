export default function FinalScreen({ onOpenLiked }) {
  return (
    <div className="final-screen">
      <h1>Вы составили свой список лучших фильмов</h1>
      <button onClick={onOpenLiked}>
        Перейти к понравившимся
      </button>
    </div>
  );
}
