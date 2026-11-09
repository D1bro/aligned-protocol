// "Your coach" on the member's Coaching page: name, photo, short bio and
// credentials, as their coach wrote them (coach profile).
export function YourCoach({ coach }: { coach: { name: string; photoUrl: string | null; bio: string; credentials: string } }) {
  return (
    <section className="your-coach" aria-labelledby="your-coach-h">
      {coach.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- the coach's own uploaded photo
        <img src={coach.photoUrl} alt="" />
      ) : (
        <span className="cpf-photo-empty" aria-hidden="true">{coach.name.trim().charAt(0).toUpperCase()}</span>
      )}
      <div>
        <p className="au-detail-k">Your coach</p>
        <h2 id="your-coach-h">{coach.name}</h2>
        {coach.bio ? <p className="your-coach-bio">{coach.bio}</p> : null}
        {coach.credentials ? <p className="your-coach-cred">{coach.credentials}</p> : null}
      </div>
    </section>
  );
}
