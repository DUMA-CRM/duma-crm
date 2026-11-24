'use client';

import { Fragment, useId, useRef, useState } from 'react';

import { ArrowLeft, ArrowRight, Check, FileText } from '@/components/icons';
import { agreementDocument, agreementFields, agreementReady, emptyAgreement, validAgreementDate, validFee, type Agreement } from '@/lib/marketplace/creator-agreement';

import styles from './creator-agreements.module.css';

const groups = [
  { en: 'Parties', uk: 'Сторони', title: 'Campaign and parties', titleUk: 'Кампанія та сторони', fields: agreementFields.slice(0, 3) },
  { en: 'Deliverables', uk: 'Матеріали', title: 'Deliverables and approvals', titleUk: 'Матеріали та погодження', fields: agreementFields.slice(3, 7) },
  { en: 'Payment', uk: 'Оплата', title: 'Fee and payment', titleUk: 'Винагорода та оплата', fields: agreementFields.slice(7, 9) },
  { en: 'Rights and terms', uk: 'Права й умови', title: 'Usage and cancellation', titleUk: 'Використання та скасування', fields: agreementFields.slice(9) },
];

function printAgreement(agreement: Agreement) {
  const embedded = window.parent !== window;
  const page = embedded ? window : window.open('', '_blank', 'popup');
  if (!page) return false;
  if (!embedded) page.opener = null;
  const doc = page.document;
  const printable = doc.createElement('main');
  printable.id = 'creator-agreement-print';
  doc.getElementById(printable.id)?.remove();
  const agreementCopy = agreementDocument(agreement);
  printable.lang = agreement.language === 'uk' ? 'uk' : 'en-GB';
  if (!embedded) doc.title = agreementCopy.campaign + ' · ' + agreementCopy.title;
  const style = doc.createElement('style');
  style.textContent = `
    @page { margin: 19mm; }
    ${embedded ? '@media screen { #creator-agreement-print { display: none; } }' : ''}
    #creator-agreement-print { margin: 36px auto; padding: 0 24px; max-width: 680px; color: #192c28; background: white; font: 11pt/1.55 Georgia, serif; }
    @media print {
      body > :not(#creator-agreement-print) { display: none !important; }
      body { margin: 0; padding: 0; background: white; }
      #creator-agreement-print { margin: 0; padding: 0; max-width: none; }
    }
    #creator-agreement-print h1 { font-size: 26pt; line-height: 1.1; margin: 0 0 10pt; }
    #creator-agreement-print h2 { font-size: 12pt; margin: 16pt 0 4pt; break-after: avoid; }
    #creator-agreement-print p { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; orphans: 3; widows: 3; }
    #creator-agreement-print section:last-child { break-inside: avoid; }
  `;
  printable.append(style);
  function append(parent: HTMLElement, tag: 'h1' | 'h2' | 'p', content: string) {
    const element = doc.createElement(tag);
    element.textContent = content;
    parent.append(element);
  }
  append(printable, 'h1', agreementCopy.title);
  append(printable, 'p', agreementCopy.campaign);
  agreementCopy.sections.forEach(({ heading, body }, index) => {
    const section = doc.createElement('section');
    append(section, 'h2', `${index + 1}. ${heading}`);
    append(section, 'p', body);
    printable.append(section);
  });
  doc.body.append(printable);
  if (embedded) page.addEventListener('afterprint', () => printable.remove(), { once: true });
  page.focus();
  page.print();
  return true;
}


type FieldKey = typeof agreementFields[number]['key'] | 'law';

export function CreatorAgreements({ initial = emptyAgreement, onSave, saving }: {
  initial?: Agreement;
  onSave?: (agreement: Agreement) => void;
  saving?: boolean;
}) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [agreement, setAgreement] = useState(initial);
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState<number[]>([]);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const uk = agreement.language === 'uk';
  const t = (en: string, ua: string) => uk ? ua : en;
  const copy = agreementDocument(agreement);
  const ready = agreementReady(agreement);
  const group = groups[step]!;
  const lastStep = step === groups.length - 1;

  function errorFor(key: FieldKey) {
    const value = agreement[key].trim();
    if (key === 'additional') return;
    if (!value) return t('Required', 'Обов’язкове поле');
    if (key === 'fee' && !validFee(value)) return t('Enter a positive amount with up to two decimal places.', 'Вкажіть додатну суму з не більш ніж двома знаками після коми.');
    if ((key === 'draftDate' || key === 'publishDate') && !validAgreementDate(value)) return t('Enter a valid date.', 'Вкажіть дійсну дату.');
    if (key === 'publishDate' && agreement.publishDate < agreement.draftDate) return t('Choose a date on or after the draft deadline.', 'Оберіть дату, що не передує строку подання чернетки.');
  }

  const problems = groups.map(({ fields }, index) => {
    const keys: FieldKey[] = fields.map(({ key }) => key);
    if (index === 0) keys.push('law');
    return keys.find((key) => errorFor(key));
  });

  function update<K extends keyof Agreement>(key: K, value: Agreement[K]) {
    setAgreement((current) => ({ ...current, [key]: value }));
  }

  function visit(index: number, focus?: FieldKey) {
    setStep(index);
    requestAnimationFrame(() => {
      const target = focus ? form.current?.elements.namedItem(focus) : heading.current;
      if (target instanceof HTMLElement) target.focus();
    });
  }

  function checkStep(index: number) {
    setChecked((current) => current.includes(index) ? current : [...current, index]);
    visit(index, problems[index]);
  }

  function exportAgreement() {
    if (!ready) {
      const index = problems.findIndex(Boolean);
      if (index >= 0) checkStep(index);
      return;
    }
    setPopupBlocked(!printAgreement(agreement));
  }

  function advance() {
    if (problems[step]) checkStep(step);
    else if (lastStep) exportAgreement();
    else visit(step + 1);
  }

  const hasErrors = checked.includes(step);
  const lawError = hasErrors ? errorFor('law') : undefined;

  return (
    <div className={styles.app} lang={uk ? 'uk' : 'en-GB'}>
      <header className={styles.header}>
        <div>
          <h2>{t('Agreement editor', 'Редактор договору')}</h2>
          <p>{t('Build an agreement for your paid creator campaign.', 'Підготуйте договір для рекламної кампанії з автором.')}</p>
        </div>
        <div className={styles.headerActions}>
          {onSave && <button type="button" className={styles.secondary} disabled={saving || !agreement.campaign.trim()} onClick={() => onSave(agreement)}>
            {saving ? t('Saving…', 'Збереження…') : t('Save a copy', 'Зберегти копію')}
          </button>}
        <label className={styles.language}>{t('Document language', 'Мова документа')}
          <select value={agreement.language} onChange={(event) => update('language', event.target.value as Agreement['language'])}>
            <option value="en" lang="en-GB">English (UK)</option>
            <option value="uk" lang="uk">Українська</option>
          </select>
        </label>
        </div>
      </header>

      <div className={styles.columns}>
        <form ref={form} className={styles.editor} noValidate onSubmit={(event) => { event.preventDefault(); advance(); }}>
          <nav aria-label={t('Agreement steps', 'Кроки підготовки договору')} className={styles.steps}>
            {groups.map(({ en, uk: label }, index) => (
              <button key={en} type="button" className={styles.step} aria-current={index === step ? 'step' : undefined}
                onClick={() => visit(index)}>
                <span className={styles.stepMark} aria-hidden="true">{problems[index] ? index + 1 : <Check size={13} />}</span>
                <span>{t(en, label)}</span>
              </button>
            ))}
          </nav>
          <div className={styles.section}>
            <h3 ref={heading} tabIndex={-1}>{t(group.title, group.titleUk)}</h3>
            <div className={styles.fields}>
              {group.fields.map((field) => {
                const { key } = field;
                const type = 'type' in field ? field.type : 'text';
                const error = hasErrors ? errorFor(key) : undefined;
                const hintId = `${id}-${key}-hint`;
                const errorId = `${id}-${key}-error`;
                const props = {
                  id: `${id}-${key}`,
                  name: key,
                  value: agreement[key],
                  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(key, event.target.value),
                  required: key !== 'additional',
                  'aria-invalid': Boolean(error) || undefined,
                  'aria-describedby': [key === 'usage' ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined,
                };
                return (
                  <Fragment key={key}>
                    <div className={'wide' in field || key === 'campaign' ? styles.wide : undefined}>
                      <label htmlFor={props.id}>{uk ? field.uk : field.en}</label>
                      {'multiline' in field ? <textarea {...props} rows={3} maxLength={6000} /> : (
                        <input {...props} type={type === 'date' ? 'date' : 'text'}
                          min={key === 'publishDate' ? agreement.draftDate || '1900-01-01' : type === 'date' ? '1900-01-01' : undefined}
                          max={type === 'date' ? '9999-12-31' : undefined}
                          inputMode={type === 'money' ? 'decimal' : undefined}
                          maxLength={type === 'money' ? 12 : 600} />
                      )}
                      {key === 'usage' && <p className={styles.hint} id={hintId}>{t('Specify paid promotion and account permissions, or enter “No reuse”.', 'Зазначте умови платного просування та доступу до акаунта або напишіть «Без повторного використання».')}</p>}
                      {error && <p id={errorId} className={styles.error}>{error}</p>}
                    </div>
                    {key === 'fee' && (
                      <div>
                        <label htmlFor={`${id}-currency`}>{t('Currency', 'Валюта')}</label>
                        <select id={`${id}-currency`} value={agreement.currency} onChange={(event) => update('currency', event.target.value as Agreement['currency'])}>
                          {['GBP', 'UAH', 'EUR', 'USD'].map((currency) => <option key={currency}>{currency}</option>)}
                        </select>
                      </div>
                    )}
                  </Fragment>
                );
              })}
              {step === 0 && <div className={styles.wide}>
                <label htmlFor={`${id}-law`}>{t('Governing law', 'Застосовне право')}</label>
                <select id={`${id}-law`} name="law" required aria-invalid={Boolean(lawError) || undefined}
                  aria-describedby={lawError ? `${id}-law-error` : undefined}
                  value={agreement.law} onChange={(event) => update('law', event.target.value as Agreement['law'])}>
                  <option value="">{t('Choose jurisdiction', 'Оберіть юрисдикцію')}</option>
                  <option value="england-wales">{t('England and Wales', 'Англія та Уельс')}</option>
                  <option value="ukraine">{t('Ukraine', 'Україна')}</option>
                </select>
                {lawError && <p id={`${id}-law-error`} className={styles.error}>{lawError}</p>}
              </div>}
            </div>
          </div>
          <footer className={styles.actions}>
            {step > 0 && <button className={styles.secondary} type="button" onClick={() => visit(step - 1)}><ArrowLeft size={16} aria-hidden="true" />{t('Back', 'Назад')}</button>}
            <button className={styles.primary} type="submit">
              {lastStep ? t('Print / Save PDF', 'Друк / Зберегти PDF') : t('Continue', 'Далі')}
              {!lastStep && <ArrowRight size={16} aria-hidden="true" />}
            </button>
          </footer>
        </form>

        <section className={styles.preview} aria-labelledby={`${id}-preview`}>
          <div className={styles.toolbar}>
            <h3 id={`${id}-preview`}><FileText size={18} aria-hidden="true" />{t('Live preview', 'Попередній перегляд')}</h3>
            <button className={styles.secondary} type="button" onClick={exportAgreement}>{t('Print / Save PDF', 'Друк / Зберегти PDF')}</button>
          </div>
          {popupBlocked && <p role="alert" className={styles.printError}>{t('Allow pop-ups for DUMA and try again.', 'Дозвольте спливні вікна для DUMA та повторіть спробу.')}</p>}
          <div className={styles.previewScroll} tabIndex={0} role="region" aria-label={copy.title}>
            <article className={styles.paper}>
              <p className={styles.campaign}>{agreement.campaign.trim() || t('Untitled campaign', 'Кампанія без назви')}</p>
              <h4>{copy.title}</h4>
              {copy.sections.map(({ heading: title, body }, index) => (
                <section key={title}>
                  <h5>{index + 1}. {title}</h5>
                  <p>{body}</p>
                </section>
              ))}
            </article>
          </div>
          <p className={styles.note}>{t('Have a qualified lawyer review your agreement before sharing it.', 'Перед надсиланням договору покажіть його кваліфікованому юристу.')}</p>
        </section>
      </div>
    </div>
  );
}
