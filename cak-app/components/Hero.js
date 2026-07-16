import styles from '../styles/Hero.module.css';

export default function Hero({ eyebrow, title, lead, short }) {
  return (
    <section className={`${styles.hero} ${short ? styles.short : ''}`}>
      <div className={styles.glow} />
      <img src="/container.png" alt="" className={styles.img} />
      <div className={styles.shade} />
      <div className={styles.inner}>
        {eyebrow && <div className={`eyebrow ${styles.eye}`}>{eyebrow}</div>}
        <h1 className={styles.h1}>{title}</h1>
        {lead && <p className={styles.lead}>{lead}</p>}
      </div>
    </section>
  );
}
