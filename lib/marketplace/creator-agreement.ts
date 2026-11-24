export const agreementFields = [
  { key: 'campaign', en: 'Campaign name', uk: 'Назва кампанії' },
  { key: 'advertiser', en: 'Advertiser’s legal name and address', uk: 'Ім’я або найменування та адреса замовника', wide: true },
  { key: 'creator', en: 'Creator’s legal name and address', uk: 'Ім’я або найменування та адреса виконавця', wide: true },
  { key: 'deliverables', en: 'Deliverables, channels, accounts and requirements', uk: 'Матеріали, канали, акаунти та вимоги', wide: true, multiline: true },
  { key: 'draftDate', en: 'Draft due', uk: 'Строк подання чернетки', type: 'date' },
  { key: 'publishDate', en: 'Publication date', uk: 'Дата публікації', type: 'date' },
  { key: 'approval', en: 'Review deadline, revisions and minimum time live', uk: 'Строк погодження, правки та мінімальний строк публікації', wide: true, multiline: true },
  { key: 'fee', en: 'Total fee', uk: 'Загальна винагорода', type: 'money' },
  { key: 'payment', en: 'Invoice, payment deadline and tax treatment', uk: 'Рахунок, строк оплати та умови оподаткування', wide: true, multiline: true },
  { key: 'usage', en: 'Permitted use, media, territory and licence term', uk: 'Способи використання, канали, територія та строк ліцензії', wide: true, multiline: true },
  { key: 'cancellation', en: 'Cancellation notice, fees and refunds', uk: 'Повідомлення про скасування, оплата та повернення коштів', wide: true, multiline: true },
  { key: 'additional', en: 'Additional terms (optional)', uk: 'Додаткові умови (необов’язково)', wide: true, multiline: true },
] as const;

type Field = typeof agreementFields[number]['key'];
export type AgreementLanguage = 'en' | 'uk';
export type Agreement = Record<Field, string> & {
  language: AgreementLanguage;
  law: '' | 'england-wales' | 'ukraine';
  currency: 'GBP' | 'UAH' | 'EUR' | 'USD';
};

export const emptyAgreement: Agreement = {
  language: 'en', law: '', currency: 'GBP', campaign: '', advertiser: '', creator: '',
  deliverables: '', draftDate: '', publishDate: '', approval: '', fee: '', payment: '',
  usage: '', cancellation: '', additional: '',
};

export function validFee(value: string) {
  return /^\d{1,9}(?:[.,]\d{1,2})?$/.test(value.trim()) && Number(value.trim().replace(',', '.')) > 0;
}

export function validAgreementDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01') return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(value + 'T');
}

export function agreementReady(agreement: Agreement) {
  return Boolean(agreement.law && validAgreementDate(agreement.draftDate)
    && validAgreementDate(agreement.publishDate) && agreement.publishDate >= agreement.draftDate
    && validFee(agreement.fee)
    && agreementFields.every(({ key }) => key === 'additional' || agreement[key].trim()));
}

export function agreementDocument(a: Agreement) {
  const uk = a.language === 'uk';
  const choose = (en: string, ua: string) => uk ? ua : en;
  const field = (key: Field) => a[key].trim() || '[…]';
  const date = (key: 'draftDate' | 'publishDate') => {
    if (!validAgreementDate(a[key])) return '[…]';
    return new Intl.DateTimeFormat(uk ? 'uk-UA' : 'en-GB', { dateStyle: 'long', timeZone: 'UTC' })
      .format(new Date(a[key] + 'T00:00:00Z'));
  };
  const fee = validFee(a.fee) ? new Intl.NumberFormat(uk ? 'uk-UA' : 'en-GB', {
    style: 'currency', currency: a.currency, currencyDisplay: 'code',
  }).format(Number(a.fee.trim().replace(',', '.'))) : '[…]';
  const law = a.law === 'england-wales'
    ? choose('The law of England and Wales governs this agreement. The courts of England and Wales have exclusive jurisdiction, subject to mandatory law.', 'До цього договору застосовується право Англії та Уельсу. Суди Англії та Уельсу мають виключну юрисдикцію з урахуванням імперативних норм.')
    : a.law === 'ukraine'
      ? choose('Ukrainian law governs this agreement. Disputes shall be heard by the competent courts of Ukraine in accordance with mandatory law.', 'До цього договору застосовується право України. Спори розглядаються компетентними судами України відповідно до імперативних норм.')
      : '[…]';
  const clause = (heading: string, body: string) => ({ heading, body });

  return {
    title: choose('Creator advertising agreement', 'Договір про створення та розміщення реклами'),
    campaign: field('campaign'),
    sections: [
      clause(choose('Parties', 'Сторони'), choose(
        `Advertiser: ${field('advertiser')}\nCreator: ${field('creator')}\nThis agreement takes effect on the date of the last signature.`,
        `Замовник: ${field('advertiser')}\nВиконавець: ${field('creator')}\nДоговір набирає чинності в день його підписання останньою зі сторін.`,
      )),
      clause(choose('Deliverables and schedule', 'Матеріали та строки'), choose(
        `The Creator will produce and publish the following materials for the campaign.\n${field('deliverables')}\nDraft due: ${date('draftDate')}\nPublication date: ${date('publishDate')}\nReview, revisions and time live: ${field('approval')}\nThe Creator must obtain written approval before publishing. If approval is delayed, the parties must agree a revised schedule in writing.`,
        `Виконавець створює та публікує такі матеріали для кампанії.\n${field('deliverables')}\nПодання чернетки: ${date('draftDate')}\nДата публікації: ${date('publishDate')}\nПогодження, правки та строк розміщення: ${field('approval')}\nДо публікації Виконавець отримує письмове погодження. У разі затримки погодження сторони письмово узгоджують нові строки.`,
      )),
      clause(choose('Fee and payment', 'Винагорода та оплата'), choose(
        `Total fee: ${fee}. The fee covers the services and any licence expressly granted below.\n${field('payment')}`,
        `Загальна винагорода: ${fee}. Винагорода охоплює послуги та ліцензію, прямо надану нижче, якщо така є.\n${field('payment')}`,
      )),
      clause(choose('Advertising disclosure', 'Позначення реклами'), choose(
        'The Creator must clearly identify each paid placement as advertising from the outset, using a prominent label understood by its audience, and use any platform disclosure tools required. Both parties must comply with applicable advertising rules in the target markets. The Advertiser must substantiate claims it supplies, and the Creator must avoid misleading claims and correct or remove non-compliant content promptly.',
        'Виконавець чітко позначає кожне рекламне розміщення з початку показу помітним і зрозумілим для аудиторії маркуванням та використовує обов’язкові інструменти платформи. Сторони дотримуються застосовних правил реклами на цільових ринках. Замовник підтверджує надані ним твердження, а Виконавець уникає оманливих тверджень і невідкладно виправляє або видаляє матеріали, які порушують вимоги.',
      )),
      clause(choose('Content rights', 'Права на матеріали'), choose(
        `The Creator retains ownership of original deliverables. Where reuse is expressly permitted below, upon full payment the Creator grants the Advertiser a non-exclusive licence to the approved final deliverables only for the uses, media, territory and term specified below. Paid promotion, edits, sublicensing and use of the Creator’s name, image or account for advertising require express written permission. Each party will obtain the permissions needed for materials it supplies.\n${field('usage')}`,
        `Виконавець зберігає майнові авторські права на створені ним матеріали. Якщо повторне використання прямо дозволено нижче, після повної оплати Виконавець надає Замовнику невиключну ліцензію на погоджені остаточні матеріали виключно для визначених нижче способів використання, каналів, території та строку. Платне просування, зміни, субліцензування та рекламне використання імені, зображення або акаунта Виконавця потребують прямого письмового дозволу. Кожна сторона отримує необхідні дозволи щодо наданих нею матеріалів.\n${field('usage')}`,
      )),
      clause(choose('Cancellation and changes', 'Скасування та зміни'), choose(
        `A party may terminate for a material breach if it is not remedied within seven calendar days of written notice, or immediately if the breach cannot be remedied. The following agreed cancellation terms apply, subject to mandatory law. Changes must be agreed in writing by both parties.\n${field('cancellation')}`,
        `Сторона може розірвати договір у разі істотного порушення, якщо його не усунуто протягом семи календарних днів з дати отримання письмового повідомлення, або негайно, якщо порушення неможливо усунути. Узгоджені нижче умови скасування застосовуються з урахуванням імперативних норм. Зміни письмово погоджують обидві сторони.\n${field('cancellation')}`,
      )),
      ...(a.additional.trim() ? [clause(choose('Additional terms', 'Додаткові умови'), a.additional.trim())] : []),
      clause(choose('Governing law and disputes', 'Застосовне право та спори'), law),
      clause(choose('Signatures', 'Підписи'), choose(
        'Advertiser representative: ____________________\nSignature: ____________________   Date: ______________\n\nCreator representative: ____________________\nSignature: ____________________   Date: ______________',
        'Представник Замовника: ____________________\nПідпис: ____________________   Дата: ______________\n\nПредставник Виконавця: ____________________\nПідпис: ____________________   Дата: ______________',
      )),
    ],
  };
}
