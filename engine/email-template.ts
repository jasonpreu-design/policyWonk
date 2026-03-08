import type { DigestData } from "./jobs/digest-generator";

function trendArrow(trend: "improving" | "stable" | "declining"): string {
  switch (trend) {
    case "improving":
      return '<span style="color: #22c55e; font-size: 18px;">&#9650;</span>';
    case "declining":
      return '<span style="color: #ef4444; font-size: 18px;">&#9660;</span>';
    case "stable":
      return '<span style="color: #6b7280; font-size: 18px;">&#9644;</span>';
  }
}

function alertTypeBadge(type: string): string {
  const colors: Record<string, string> = {
    bill: "#3b82f6",
    amendment: "#8b5cf6",
    committee: "#06b6d4",
    vote: "#f59e0b",
    news: "#10b981",
    state_legislation: "#ec4899",
  };
  const bg = colors[type] || "#6b7280";
  return `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; color: white; background: ${bg}; text-transform: uppercase; letter-spacing: 0.5px;">${type.replace("_", " ")}</span>`;
}

export function renderDigestEmail(data: DigestData): string {
  const scorePercent = Math.round(data.quizPerformance.averageScore * 100);

  // Alerts section
  let alertsHtml = "";
  if (data.newAlerts.length > 0) {
    const alertItems = data.newAlerts
      .map(
        (a) =>
          `<tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
              ${alertTypeBadge(a.type)}
              <span style="margin-left: 8px; color: #1f2937;">${a.title}</span>
              ${a.domain ? `<span style="color: #9ca3af; font-size: 12px; margin-left: 4px;">${a.domain}</span>` : ""}
            </td>
          </tr>`,
      )
      .join("");
    alertsHtml = `
      <div style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
        <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #1a2744;">New Alerts (${data.newAlerts.length})</h2>
        <table style="width: 100%; border-collapse: collapse;">${alertItems}</table>
      </div>`;
  }

  // Performance section
  let performanceDetails = "";
  if (data.quizPerformance.bestTopic) {
    performanceDetails += `<span style="color: #22c55e;">Best: ${data.quizPerformance.bestTopic}</span>`;
  }
  if (data.quizPerformance.weakestTopic) {
    if (performanceDetails) performanceDetails += " &middot; ";
    performanceDetails += `<span style="color: #f59e0b;">Needs work: ${data.quizPerformance.weakestTopic}</span>`;
  }

  const performanceHtml = `
    <div style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #1a2744;">Performance ${trendArrow(data.quizPerformance.trend)}</h2>
      <p style="margin: 0; color: #4b5563;">
        ${data.quizPerformance.questionsAnswered} questions answered
        ${data.quizPerformance.questionsAnswered > 0 ? ` &middot; ${scorePercent}% average` : ""}
      </p>
      ${performanceDetails ? `<p style="margin: 8px 0 0 0; font-size: 13px;">${performanceDetails}</p>` : ""}
    </div>`;

  // Milestones section
  let milestonesHtml = "";
  if (data.competencyMilestones.length > 0) {
    const milestoneItems = data.competencyMilestones
      .map(
        (m) =>
          `<div style="background: #fef9c3; border-left: 3px solid #f59e0b; padding: 8px 12px; margin-bottom: 8px; border-radius: 0 4px 4px 0;">
            <strong>${m.topic}</strong>: ${m.oldTier} &rarr; ${m.newTier}
          </div>`,
      )
      .join("");
    milestonesHtml = `
      <div style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
        <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #1a2744;">Milestones</h2>
        ${milestoneItems}
      </div>`;
  }

  // Recommendations section
  let recommendationsHtml = "";
  if (data.curriculumRecommendations.length > 0) {
    const recItems = data.curriculumRecommendations
      .map(
        (r) =>
          `<li style="margin-bottom: 6px;">
            <strong>${r.topicName}</strong> <span style="color: #9ca3af; font-size: 12px;">${r.domain}</span>
            <br><span style="color: #6b7280; font-size: 13px;">${r.reason}</span>
          </li>`,
      )
      .join("");
    recommendationsHtml = `
      <div style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
        <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #1a2744;">Today's Recommendations</h2>
        <ul style="margin: 0; padding-left: 20px; color: #1f2937;">${recItems}</ul>
      </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background: #f9fafb;">
  <!-- Header -->
  <div style="background: #1a2744; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 22px; font-weight: 600;">Wonk HQ Daily Briefing</h1>
    <p style="margin: 6px 0 0 0; opacity: 0.8; font-size: 14px;">${data.date}</p>
  </div>

  <!-- Content -->
  <div style="background: white; padding: 20px 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
    <!-- Stats Row -->
    <div style="display: flex; justify-content: space-around; text-align: center; padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
      <div>
        <div style="font-size: 28px; font-weight: bold; color: #1a2744;">${data.streak}</div>
        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Day Streak</div>
      </div>
      <div>
        <div style="font-size: 28px; font-weight: bold; color: #1a2744;">${data.quizPerformance.questionsAnswered > 0 ? scorePercent + "%" : "--"}</div>
        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Avg Score</div>
      </div>
      <div>
        <div style="font-size: 28px; font-weight: bold; color: #1a2744;">${data.reviewsDue}</div>
        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Reviews Due</div>
      </div>
    </div>

    ${alertsHtml}
    ${performanceHtml}
    ${milestonesHtml}
    ${recommendationsHtml}

    <!-- CTA -->
    <div style="text-align: center; padding: 24px 0 8px 0;">
      <a href="http://localhost:3000" style="display: inline-block; background: #e85d4a; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px;">Open Wonk HQ</a>
    </div>
  </div>

  <!-- Footer -->
  <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
    PolicyWonk &middot; Your daily policy intelligence briefing
  </div>
</body>
</html>`;
}
