import Link from "next/link";
import { getActiveGoals } from "@/lib/actions/clear";

export default async function GoalsPage() {
  const goals = await getActiveGoals();

  return (
    <div className="page">
      <div className="eyebrow"><span className="eydot" /> My Goals</div>
      <h1>Your active goals</h1>

      {goals.length === 0 ? (
        <>
          <p className="lead">
            You don&apos;t have any goals yet — goals come out of the CLEAR process, which starts once
            you&apos;ve completed an audit and picked a focus area.
          </p>
          <Link href="/" className="btn btn-p">Go to my dashboard</Link>
        </>
      ) : (
        <div className="g2">
          {goals.map((g) => (
            <div key={g.id} className="card">
              <div className="hbox-l" style={{ marginBottom: 4 }}>
                {g.goal_type === "primary" ? "Primary" : "Supporting"}{g.focus_area ? ` · ${g.focus_area}` : ""}
              </div>
              <h3 style={{ margin: "0 0 .35rem" }}>{g.goal_title}</h3>
              {g.action_text ? <p className="body-t" style={{ marginBottom: ".5rem" }}>{g.action_text}</p> : null}
              {g.motivation_text ? (
                <p className="body-t" style={{ marginBottom: ".5rem", fontStyle: "italic" }}>
                  &ldquo;{g.motivation_text}&rdquo;
                </p>
              ) : null}
              {g.frequency ? <div className="focus-badge">{g.frequency}</div> : null}
              {g.success_criteria ? (
                <p className="body-t" style={{ marginTop: ".5rem" }}>
                  <strong>Success looks like:</strong> {g.success_criteria}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
