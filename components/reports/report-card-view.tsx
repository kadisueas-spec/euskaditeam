"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { CardLink, ReportCard } from "@/lib/reports/types";
import { fmtKg, fmtNum } from "@/lib/reports/format";
import styles from "./report-player.module.css";
import { ShareCardButton } from "./share-card-button";

// Una tarjeta del reporte. `interactive = false` en la vista previa del
// coach: los links no navegan (son la app del cliente).

function CardLinkButton({ link, interactive }: { link?: CardLink; interactive: boolean }) {
  if (!link) return null;
  const content = (
    <>
      {link.label} <ArrowRight aria-hidden />
    </>
  );
  return interactive ? (
    <Link href={link.href} className={styles.link}>
      {content}
    </Link>
  ) : (
    <span className={styles.link}>{content}</span>
  );
}

function Signature({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <div className={styles.sig}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar de Storage, tamaño fijo
        <img className={styles.av} src={avatarUrl} alt="" />
      ) : (
        <span className={styles.av}>{name.charAt(0).toUpperCase()}</span>
      )}
      <div>
        <b>{name}</b>
        <span>Tu coach</span>
      </div>
    </div>
  );
}

function Sparkline({ series, lastLabel }: { series: { weekStart: string; kg: number }[]; lastLabel: string }) {
  if (series.length < 2) return null;
  const W = 350;
  const H = 150;
  const padX = 8;
  const padY = 22;
  const vals = series.map((p) => p.kg);
  const min = Math.min(...vals) - 0.3;
  const max = Math.max(...vals) + 0.3;
  const xy = series.map((p, i) => [
    padX + (i * (W - padX * 2)) / (series.length - 1),
    padY + ((max - p.kg) / (max - min)) * (H - padY * 2),
  ]);
  let len = 0;
  for (let i = 1; i < xy.length; i++) len += Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]);
  const d = xy.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const first = series[0];
  const last = series[series.length - 1];
  const firstLabel = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${first.weekStart}T00:00:00Z`))
    .replace(".", "");
  return (
    <svg
      className={styles.spark}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Peso promedio por semana, de ${fmtKg(first.kg)} a ${fmtKg(last.kg)} kg`}
    >
      <path className={styles.ln} d={d} style={{ "--len": Math.ceil(len) } as React.CSSProperties} />
      {xy.map((p, i) => (
        <circle
          key={i}
          className={`${styles.pt} ${i === xy.length - 1 ? styles.last : ""}`}
          cx={p[0]}
          cy={p[1]}
          r={i === xy.length - 1 ? 6 : 4}
          style={{ animationDelay: `${200 + i * 110}ms` }}
        />
      ))}
      <text x={xy[0][0]} y={H - 2}>
        {firstLabel} · {fmtKg(first.kg)} kg
      </text>
      <text x={W - padX} y={H - 2} textAnchor="end">
        {lastLabel} · {fmtKg(last.kg)} kg
      </text>
    </svg>
  );
}

function Marks({ rows }: { rows: { exercise: string; value: string; diff: string }[] }) {
  return (
    <ul className={styles.marks}>
      {rows.map((m) => (
        <li key={m.exercise}>
          <span>{m.exercise}</span>
          <span className={styles.v}>
            {m.value} <em>{m.diff}</em>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ReportCardView({ card, interactive }: { card: ReportCard; interactive: boolean }) {
  const phrase = card.phrase ? <p className={styles.phrase}>{card.phrase}</p> : null;
  const foot = card.link ? (
    <div className={styles.foot}>
      <CardLinkButton link={card.link} interactive={interactive} />
    </div>
  ) : null;

  switch (card.type) {
    case "opening":
      return (
        <>
          <h1 className={`${styles.display} ${styles.openingWord}`}>
            {card.words.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </h1>
          <div className={`${styles.foot} ${styles.rise}`}>
            {card.phrase && <p className={styles.phraseLg}>{card.phrase}</p>}
          </div>
        </>
      );

    case "improvement":
      return (
        <>
          <div className={styles.rise}>
            <p className={styles.kicker}>{card.kicker}</p>
            <p className={styles.exName}>{card.exercise}</p>
          </div>
          <div className={styles.focusIn} style={{ marginTop: 6 }}>
            <span className={`${styles.display} ${styles.big}`}>{card.value}</span>
            <span className={`${styles.display} ${styles.unit}`}>{card.unit}</span>
          </div>
          <div className={styles.rise}>
            <p className={styles.sub}>{card.detail}</p>
            {card.phrase && (
              <p className={styles.phrase} style={{ marginTop: 16 }}>
                {card.phrase}
              </p>
            )}
          </div>
          {card.more.length > 0 && (
            <div className={styles.rise} style={{ marginTop: 18 }}>
              <p className={styles.kicker} style={{ marginBottom: 2 }}>
                Y {card.more.length} {card.more.length === 1 ? "mejor marca" : "mejores marcas"} más
              </p>
              <Marks rows={card.more} />
            </div>
          )}
          {foot}
        </>
      );

    case "effort":
      return (
        <>
          <div className={styles.rise}>
            <p className={styles.kicker}>Tu semana</p>
          </div>
          <div className={styles.focusIn} style={{ marginTop: 6 }}>
            <span className={`${styles.display} ${styles.big}`}>{card.sets}</span>
            <span className={`${styles.display} ${styles.unit}`}>series</span>
          </div>
          <div className={styles.rise}>
            <p className={styles.sub}>{fmtNum(card.volumeKg)} kg movidos</p>
            {card.phrase && (
              <p className={styles.phrase} style={{ marginTop: 16 }}>
                {card.phrase}
              </p>
            )}
          </div>
          {foot}
        </>
      );

    case "adherence":
      return (
        <>
          <div className={styles.rise}>
            <p className={styles.kicker}>Lunes a viernes</p>
          </div>
          <div className={styles.focusIn} style={{ marginTop: 6 }}>
            <span className={`${styles.display} ${styles.big}`}>{card.done}</span>
            <span className={`${styles.display} ${styles.unit}`}>de {card.planned}</span>
          </div>
          <div className={styles.week}>
            {card.days.map((d, i) => (
              <div key={i} className={`${styles.day} ${d.dayName ? styles.dayOn : ""}`}>
                <i>{d.dayName && <Check aria-hidden strokeWidth={3} />}</i>
                <small>{d.label}</small>
                <span className={styles.dayName}>{d.dayName ?? ""}</span>
              </div>
            ))}
          </div>
          <div className={styles.rise} style={{ marginTop: 28 }}>
            {phrase}
          </div>
          {foot}
        </>
      );

    case "count":
      return (
        <>
          <div className={styles.rise}>
            <p className={styles.kicker}>{card.kicker}</p>
          </div>
          <div className={styles.focusIn} style={{ marginTop: 6 }}>
            <span className={`${styles.display} ${styles.big}`}>{card.value}</span>
          </div>
          <div className={styles.rise}>
            <p className={styles.exName}>{card.label}</p>
            <p className={styles.sub} style={{ marginTop: 6 }}>
              {card.detail}
            </p>
            {card.phrase && (
              <p className={styles.phrase} style={{ marginTop: 20 }}>
                {card.phrase}
              </p>
            )}
          </div>
          {foot}
        </>
      );

    case "records":
      return (
        <>
          <div className={styles.rise}>
            <p className={styles.kicker}>Mejores marcas</p>
          </div>
          <div className={styles.focusIn} style={{ marginTop: 6 }}>
            <span className={`${styles.display} ${styles.big} ${styles.bigMd}`}>{card.value}</span>
          </div>
          <div className={styles.rise}>{phrase}</div>
          <div className={styles.rise} style={{ marginTop: 12 }}>
            <Marks rows={card.list} />
          </div>
          {foot}
        </>
      );

    case "volume": {
      const max = Math.max(card.previous.volumeKg, card.current.volumeKg);
      const row = (x: typeof card.previous, now: boolean) => (
        <div>
          <div className={styles.lbl}>
            <span>
              {x.label} · {x.sessions} entrenamientos
            </span>
            <b>{fmtNum(x.volumeKg)} kg</b>
          </div>
          <div className={`${styles.track} ${now ? styles.trackNow : ""}`}>
            <i style={{ width: `${(x.volumeKg / max) * 100}%` }} />
          </div>
        </div>
      );
      return (
        <>
          <div className={styles.rise}>
            <p className={styles.kicker}>Contra {card.previous.label.toLowerCase()}</p>
          </div>
          <div className={styles.focusIn} style={{ marginTop: 6 }}>
            <span className={`${styles.display} ${styles.big} ${styles.bigMd}`}>+{card.percent}</span>
            <span className={`${styles.display} ${styles.unit}`}>%</span>
          </div>
          <div className={styles.rise}>
            <p className={styles.sub}>Volumen total (series × reps × kilos)</p>
          </div>
          <div className={styles.barsCmp}>
            {row(card.previous, false)}
            {row(card.current, true)}
          </div>
          <div className={`${styles.foot} ${styles.rise}`}>
            {card.phrase && <p className={styles.phraseLg}>{card.phrase}</p>}
          </div>
        </>
      );
    }

    case "streak":
      return (
        <>
          <div className={styles.rise}>
            <p className={styles.kicker}>Tu racha</p>
          </div>
          <div className={styles.focusIn} style={{ marginTop: 6 }}>
            <span className={`${styles.display} ${styles.big}`}>{card.value}</span>
            <span className={`${styles.display} ${styles.unit}`}>{card.unit}</span>
          </div>
          <div className={styles.rise}>
            <p className={styles.phrase}>{card.detail}</p>
          </div>
        </>
      );

    case "weight":
      return (
        <>
          <div className={styles.rise}>
            <p className={styles.kicker}>{card.kicker}</p>
          </div>
          <div className={styles.focusIn} style={{ marginTop: 6 }}>
            <span className={`${styles.display} ${styles.big} ${styles.bigMd}`}>{card.headline}</span>
            <span className={`${styles.display} ${styles.unit}`}>kg</span>
          </div>
          <div className={styles.rise}>
            {card.fromTo && (
              <p className={styles.sub} style={{ fontSize: 17, color: "var(--fg)" }}>
                {card.fromTo}
              </p>
            )}
            {card.detail && (
              <p className={styles.hint} style={{ marginTop: 4 }}>
                {card.detail}
              </p>
            )}
            {card.phrase && (
              <p className={styles.phrase} style={{ marginTop: 14 }}>
                {card.phrase}
              </p>
            )}
          </div>
          <Sparkline series={card.series} lastLabel={card.lastLabel} />
          <p className={styles.hint} style={{ marginTop: 6 }}>
            Promedio de cada semana
          </p>
          {foot}
        </>
      );

    case "body":
      return (
        <>
          <div className={styles.rise}>
            <p className={styles.kicker}>Tu evaluación</p>
          </div>
          <div className={styles.focusIn} style={{ marginTop: 6 }}>
            <span className={`${styles.display} ${styles.big} ${styles.bigMd}`}>
              {card.bodyFat != null ? fmtKg(card.bodyFat) : "—"}
            </span>
            <span className={`${styles.display} ${styles.unit}`}>% grasa</span>
          </div>
          <div className={styles.rise}>
            {card.muscleKg != null && <p className={styles.sub}>{fmtKg(card.muscleKg)} kg de masa muscular</p>}
            {card.phrase && (
              <p className={styles.phrase} style={{ marginTop: 14 }}>
                {card.phrase}
              </p>
            )}
          </div>
          {foot}
        </>
      );

    case "goal":
      return (
        <>
          <div className={styles.rise}>
            <p className={styles.kicker}>Te propusiste</p>
            <p className={styles.goalQuote}>“{card.goal}”</p>
          </div>
          <ul className={`${styles.evidence} ${styles.rise}`}>
            {card.evidence.map((e) => (
              <li key={e}>
                <span className={styles.ic}>
                  <Check aria-hidden strokeWidth={3} />
                </span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
          <div className={`${styles.foot} ${styles.rise}`}>
            {card.phrase && <p className={styles.phraseLg}>{card.phrase}</p>}
          </div>
        </>
      );

    case "focus":
      return (
        <>
          <div className={styles.rise}>
            <p className={styles.kicker}>Lo que viene</p>
          </div>
          <h2
            className={`${styles.display} ${styles.outline} ${card.word.length > 8 ? styles.outlineSm : ""}`}
          >
            {card.word}
            <span className={styles.fill} aria-hidden>
              {card.word}
            </span>
          </h2>
          <div className={`${styles.foot} ${styles.rise}`}>
            {card.phrase && <p className={styles.phraseLg}>{card.phrase}</p>}
            <CardLinkButton link={card.link} interactive={interactive} />
          </div>
        </>
      );

    case "coach-message":
    case "coach-note":
      return (
        <div className={styles.slow} style={{ margin: "auto 0" }}>
          <p className={styles.kicker}>{card.type === "coach-message" ? "Mensaje de tu coach" : "Una nota para vos"}</p>
          <p className={styles.message} style={{ marginTop: 14 }}>
            {card.text}
          </p>
          <Signature name={card.coachName} avatarUrl={card.coachAvatarUrl} />
        </div>
      );

    case "closing":
      return (
        <div className={styles.slow} style={{ margin: "auto 0" }}>
          <p className={styles.display} style={{ fontSize: 96, color: "var(--red)", lineHeight: 0.85, textTransform: "uppercase" }}>
            {card.words.map((w) => (
              <span key={w} style={{ display: "block" }}>
                {w}
              </span>
            ))}
          </p>
          {card.phrase && (
            <p className={styles.phraseLg} style={{ marginTop: 28 }}>
              {card.phrase}
            </p>
          )}
          <Signature name={card.coachName} avatarUrl={card.coachAvatarUrl} />
        </div>
      );

    case "share":
      return (
        <>
          <div className={styles.rise}>
            <p className={styles.kicker}>Tu {card.monthLabel.toLowerCase()}, para compartir</p>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0, padding: "14px 0" }}>
            <div className={styles.poster}>
              <span className={styles.pBrand}>
                EUSKADI <i>TEAM</i>
              </span>
              <span className={styles.pMonth}>
                {card.words.map((w) => (
                  <span key={w} style={{ display: "block" }}>
                    {w}
                  </span>
                ))}
              </span>
              <span className={styles.pName}>{card.clientName}</span>
              <div className={styles.pStats}>
                {card.stats.map((s) => (
                  <div key={s.label}>
                    <b>{s.value}</b>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.foot}>
            <ShareCardButton card={card} interactive={interactive} />
            <p className={styles.hint} style={{ textAlign: "center" }}>
              Imagen 1080 × 1920, lista para historias
            </p>
          </div>
        </>
      );
  }
}
