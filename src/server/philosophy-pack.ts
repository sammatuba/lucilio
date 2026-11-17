import { philosophyPackSchema } from '../shared/philosophy.js';

// Static editorial material: no runtime research, personalization, or model calls.
export const PHILOSOPHY_PACK = philosophyPackSchema.parse({
  version: 'philosophy-v1.0.0',
  coverageNote: 'A curated introductory foundation, not a comprehensive history or curriculum of philosophy. These six original editorial essays and sixteen entry points invite disagreement and reader-owned inquiry; they do not speak for whole cultures. Chinese entries distinguish early Confucian and Daoist texts; Indian entries distinguish early Buddhist teachings and Nyāya epistemology; Islamic philosophy enters through al-Fārābī, and African relational philosophy through Kwame Gyekye’s Akan-centered account. These are selections, not regional representatives. Major omissions include Indigenous and Latin American philosophies, feminist and care ethics, many African, Islamic, Indian, and East Asian traditions, and sustained treatments of logic, aesthetics, political philosophy, and philosophy of science. All graph comparisons are editorial, not historical influence claims; proximity is not evidence. Source URLs returned HTTP 200 during preparation, and selected passages, headings, and author attributions were inspected. That is a limited access and interpretation check, not a full reading of every source, translation verification, expert review, or proof of consensus. The pack relies chiefly on English-language encyclopedia interpretation and links one primary-text transcription without reproducing it. Links can change. No claim of independent scholarly review is made.',
  sources: [
    {
      id: 'sep-testimony', title: 'Epistemological Problems of Testimony', author: 'Nick Leonard',
      url: 'https://plato.stanford.edu/entries/testimony-episprob/', kind: 'reference',
      locator: 'Sections 1.1–1.3, Reductionism, Non-Reductionism, and Hybrid Views; section 5, Authoritative Testimony.',
      note: 'Access check: HTTP 200; inspected the reductionist requirement for positive reasons, the regress objection, and the discussion of epistemic authorities. The entry distinguishes several positions; the essay’s practical checks are editorial proposals, not a consensus test for trustworthy people.',
    },
    {
      id: 'sep-stoicism', title: 'Stoicism', author: 'Marion Durand, Simon Shogry, and Dirk Baltzly',
      url: 'https://plato.stanford.edu/entries/stoicism/', kind: 'reference',
      locator: 'Sections 3.7, Epistemology; 4.1–4.3, The Telos, Virtue, and Indifferents; 4.7, Passions.',
      note: 'Access check: HTTP 200; inspected assent, virtue as sufficient for happiness, the status of external things, and good feelings versus passions. This systematic ancient school is not reduced here to emotional suppression or a modern control exercise; surviving evidence and later developments require care.',
    },
    {
      id: 'sep-epicurus', title: 'Epicurus', author: 'David Konstan',
      url: 'https://plato.stanford.edu/entries/epicurus/', kind: 'reference',
      locator: 'Section 4, Psychology and Ethics, especially the classification of desires and discussion of Letter to Menoeceus 127–128; sections 5–6, Social Theory and The Epicurean Life.',
      note: 'Access check: HTTP 200; inspected the distinction between natural, necessary, and empty desires, freedom from disturbance, and friendship and security. Primary-text numbering follows the entry; no independent translation collation was performed. The exact static/kinetic pleasure distinction is debated.',
    },
    {
      id: 'sep-aristotle', title: 'Aristotle’s Ethics', author: 'Richard Kraut',
      url: 'https://plato.stanford.edu/entries/aristotle-ethics/', kind: 'reference',
      locator: 'Sections 2, The Human Good and the Function Argument; 5.1–5.2, Ethical Virtue as Disposition and Ethical Theory Does Not Offer a Decision Procedure; 8–10, Pleasure, Friendship, and Three Lives Compared.',
      note: 'Access check: HTTP 200; inspected rational activity, habituation, practical judgment, friendship, and the need for external goods. The function argument and competing lives are not settled by the contemporary examples. This is an entry into Aristotle, not an endorsement of his social exclusions.',
    },
    {
      id: 'sep-skepticism', title: 'Ancient Skepticism', author: 'Katja Vogt',
      url: 'https://plato.stanford.edu/entries/skepticism-ancient/', kind: 'reference',
      locator: 'Section 1, The Central Questions; sections 3–4, Academic Skepticism and Pyrrhonian Skepticism, especially 4.2–4.4.',
      note: 'Access check: HTTP 200; inspected suspension, opposing appearances, the objection that skeptics cannot act, and the distinction between Academic and Pyrrhonian aims. Ancient suspension is not simply a modern probability estimate or the dogma that knowledge is impossible.',
    },
    {
      id: 'sep-kant', title: 'Kant’s Moral Philosophy', author: 'Robert Johnson and Adam Cureton',
      url: 'https://plato.stanford.edu/entries/kant-moral/', kind: 'reference',
      locator: 'Sections 2–3, Good Will, Moral Worth and Duty, and Duty and Respect for Moral Law; sections 5–7, Universal Law, Humanity, and Autonomy formulas.',
      note: 'Access check: HTTP 200; inspected universal moral requirements and the connection between rational agency, autonomy, and dignity. The essays use a limited reconstruction of duties and respect, not a complete account of Kant’s system or its contested applications.',
    },
    {
      id: 'kant-enlightenment', title: 'What Is Enlightenment? (1784)', author: 'Immanuel Kant; electronic text hosted by the Internet History Sourcebooks Project',
      url: 'https://sourcebooks.web.fordham.edu/mod/kant-whatis.asp', kind: 'primary',
      locator: 'Opening paragraph on tutelage; paragraph beginning “Which restriction is an obstacle to enlightenment” on public and private uses of reason.',
      note: 'Access check: HTTP 200; inspected these paragraphs and the host’s rights notice. This is an English web transcription, not a checked critical edition; no translator attribution was established in this check. Public reason means addressing a reading public, while private reason concerns an entrusted office, not today’s private life. Linked and paraphrased, not reproduced; no commercial reuse permission is inferred.',
    },
    {
      id: 'sep-utilitarianism', title: 'The History of Utilitarianism', author: 'Julia Driver',
      url: 'https://plato.stanford.edu/entries/utilitarianism-history/', kind: 'reference',
      locator: 'Introduction; section 2.2, Jeremy Bentham; section 2.3, John Stuart Mill.',
      note: 'Access check: HTTP 200; inspected overall good, Bentham’s dimensions of pleasure and pain, and Mill’s qualitative distinction. The essay treats classical utilitarianism as a family with disagreements, not as all consequentialism. Cross-cultural “proto-utilitarian” classifications in the entry are not adopted by this pack.',
    },
    {
      id: 'sep-pragmatism', title: 'Pragmatism', author: 'Catherine Legg and Christopher Hookway',
      url: 'https://plato.stanford.edu/entries/pragmatism/', kind: 'reference',
      locator: 'Section 2.1, Peirce: The Pragmatic Maxim; sections 4.1–4.2, Skepticism versus Fallibilism and Inquiry.',
      note: 'Access check: HTTP 200; inspected Peirce’s objection to merely pretended doubt and the contrast between fixing belief and Dewey’s transformation of an indeterminate situation. A reversible personal experiment is our application; pragmatism does not mean that whatever feels useful becomes true.',
    },
    {
      id: 'sep-existentialism', title: 'Existentialism', author: 'Kevin Aho',
      url: 'https://plato.stanford.edu/entries/existentialism/', kind: 'reference',
      locator: 'Section 4.2, Mediated Freedom; section 5.5, Self-Recovery in Sartre and Beauvoir; sections 6.2–6.3, The Ethics of Recognition and The Ethics of Engagement.',
      note: 'Access check: HTTP 200; inspected situated freedom, the differences between early and later Sartre, and Beauvoir’s account of social constraint. Existentialism includes incompatible religious and nonreligious approaches. The essays do not claim that choice erases oppression or creates values without responsibility to others.',
    },
    {
      id: 'sep-phenomenology', title: 'Phenomenology', author: 'David Woodruff Smith',
      url: 'https://plato.stanford.edu/entries/phenomenology/', kind: 'reference',
      locator: 'Sections 1–2, What is Phenomenology? and The Discipline of Phenomenology; section 4, The History and Varieties of Phenomenology.',
      note: 'Access check: HTTP 200; inspected intentionality, embodied experience, and Husserl’s bracketing of existence questions. The writing exercise borrows a descriptive orientation without claiming to reproduce the transcendental method. First-person description is not infallible evidence about someone else’s motives.',
    },
    {
      id: 'sep-confucius', title: 'Confucius', author: 'Mark Csikszentmihalyi',
      url: 'https://plato.stanford.edu/entries/confucius/', kind: 'reference',
      locator: 'Sections 2–5, Sources for Confucius’s Life and Thought, Ritual Psychology and Social Values, Virtues and Character Formation, and The Family and the State.',
      note: 'Access check: HTTP 200; inspected the composite textual record, ritual cultivation, ren and li, and tensions between family and political duties. This concerns selected early materials, not every later Confucian school or Chinese society. Modern criticism of exclusion in the essays is editorial, not attributed verbatim to Confucius.',
    },
    {
      id: 'sep-daoism', title: 'Daoism', author: 'Chad Hansen',
      url: 'https://plato.stanford.edu/entries/daoism/', kind: 'reference',
      locator: 'Section 1, History; sections 7–10, implications for language, epistemology, and moral theory.',
      note: 'Access check: HTTP 200; inspected the later formation of the Daoist category, differences between Laozi and Zhuangzi, and the account of learned paths and naming. Hansen’s language-centered interpretation is a particular scholarly reading, not neutral agreement among all Daoist interpreters; religious practices and later traditions are largely outside this entry point.',
    },
    {
      id: 'sep-buddha', title: 'Buddha', author: 'Mark Siderits',
      url: 'https://plato.stanford.edu/entries/buddha/', kind: 'reference',
      locator: 'Sections 1–3, Buddha as Philosopher, Core Teachings, and Non-Self; section 5, Attitude toward Reason.',
      note: 'Access check: HTTP 200; inspected suffering, its conditioned arising and cessation, and disagreement over the interpretation of non-self. The entry reconstructs early teachings preserved in Nikāyas/Āgamas; it cannot stand for all Buddhist philosophy. No meditation treatment or translation of a primary discourse is offered here.',
    },
    {
      id: 'sep-nyaya', title: 'Epistemology in Classical Indian Philosophy', author: 'Stephen Phillips and Anand Vaidya',
      url: 'https://plato.stanford.edu/entries/epistemology-india/', kind: 'reference',
      locator: 'Sections 1–3, knowledge sources, skepticism, and knowing that you know; section 6, Testimony, including Nyāya-sūtra 1.1.7 and Vātsyāyana’s commentary; section 8, Suppositional Reasoning.',
      note: 'Access check: HTTP 200; inspected Nyāya’s distinction between testimonial knowledge and its certification, and the knowledgeable, non-deceptive āpta. This is a multi-school survey; Nyāya claims are explicitly separated from Buddhist and Mīmāṃsā positions. Sūtra references are supplied by the survey, not independently checked against Sanskrit editions.',
    },
    {
      id: 'sep-farabi', title: 'al-Farabi', author: 'Therese-Anne Druart',
      url: 'https://plato.stanford.edu/entries/al-farabi/', kind: 'reference',
      locator: 'Section 3, Logic; section 6, Metaphysics, on the hierarchical city; section 7, Ethics and Politics.',
      note: 'Access check: HTTP 200; inspected logic and happiness, the relation of cosmology to political hierarchy, and the limited evidence for al-Fārābī’s ethics. Druart records interpretive disputes and a lost commentary; this pack does not resolve them or treat al-Fārābī as a spokesperson for Islam. Primary editions listed there were not independently consulted.',
    },
    {
      id: 'sep-african-ethics', title: 'African Ethics', author: 'Kwame Gyekye',
      url: 'https://plato.stanford.edu/entries/african-ethics/', kind: 'reference',
      locator: 'Sections 3–4, Character and Moral Personhood; sections 7–9, Common Good, Social Ethics, and the Ethics of Duty.',
      note: 'Access check: HTTP 200; inspected the Akan language examples, moral personhood, common good, and relational duties. Gyekye makes broad claims that this pack does not universalize: this is one Akan-centered philosophical reconstruction, not a survey establishing what all Africans believe. Our concerns about exclusion and unequal care are questions for that account, not quotations from it.',
    },
  ],
  nodes: [
    {
      id: 'testimony', title: 'Testimony and epistemic dependence', kind: 'concept', area: 'Contemporary epistemology',
      summary: 'Much of what we know comes from other people. The question is how their words can give us reasons, not whether dependence can be abolished.',
      detailMd: 'Reductionists ask for positive reasons to regard a speaker as reliable; non-reductionists defend some entitlement to accept testimony without reconstructing that evidence every time. Hybrid views complicate the division. Expertise is also domain-specific: someone can understand a problem and still mislead an audience.\n\nDistinguish evidence that a statement is true, evidence about its speaker, and the interpersonal act of trusting someone. They can overlap without being identical. The practical checks in **Trust** are an editorial application of this debate, not a diagnostic instrument for ranking people.',
      questions: ['What reasons support this claim independently of the speaker’s confidence?', 'When is asking for further evidence responsible, and when does it impose an unfair burden?'],
      sourceIds: ['sep-testimony'], readingIds: ['trust', 'uncertainty'], prerequisiteIds: [],
    },
    {
      id: 'stoicism', title: 'Stoicism: virtue, judgment, and external things', kind: 'tradition', area: 'Ancient Mediterranean',
      summary: 'The ancient Stoics made virtue sufficient for happiness while distinguishing reasonable selection of external things from treating them as genuine goods.',
      detailMd: 'Stoicism joined logic, physics, and ethics in a systematic account of life according to nature. Health, resources, and reputation are not goods in the strict sense that virtue is; this does not mean every choice concerning them is arbitrary. Assent to impressions helps explain why judgment matters ethically.\n\nThe ideal of freedom from passions is not a command to become unfeeling. The source distinguishes good feelings and involuntary preliminary reactions from passions involving mistaken valuation. Ask whether this protects moral agency against fortune or understates what deprivation can destroy. A contemporary attention exercise does not reproduce the whole Stoic system.',
      questions: ['Can an excellent life remain happy under serious deprivation?', 'Which part of an emotional response is a judgment, and which part arrives unbidden?'],
      sourceIds: ['sep-stoicism'], readingIds: ['attention', 'good-life'], prerequisiteIds: [],
    },
    {
      id: 'epicureanism', title: 'Epicureanism: pleasure and the limits of desire', kind: 'tradition', area: 'Ancient Mediterranean',
      summary: 'Epicurus connects pleasure with freedom from bodily pain and mental disturbance, examining which desires can actually be satisfied.',
      detailMd: 'Epicurean ethics belongs to a materialist account of nature, mortality, and human fear. Its distinction among natural necessary desires, natural unnecessary desires, and empty desires challenges the idea that a good life requires ever greater stimulation. Friendship and security matter to this project.\n\nDo not confuse the school with luxury consumption, or with indifference to all pleasure. Its difficult question is whether reducing ambitious desires removes needless distress or abandons valuable forms of achievement. The comparison with modern career decisions is ours, not an ancient prescription for employment.',
      questions: ['Does satisfying this desire establish a limit or produce a new comparison?', 'What would distinguish secure friendship from using friends as insurance?'],
      sourceIds: ['sep-epicurus'], readingIds: ['good-life'], prerequisiteIds: [],
    },
    {
      id: 'aristotle', title: 'Aristotle: virtue and flourishing', kind: 'tradition', area: 'Ancient Mediterranean',
      summary: 'Flourishing is activity over a life, not simply a feeling. Character, practical judgment, friendship, and circumstances all matter.',
      detailMd: 'Aristotle’s function argument connects human flourishing with rational activity in accordance with excellence. Ethical character grows through habituation, but good judgment is not a mechanical application of a rule or an arithmetic average between extremes. The demands of a situation have to be perceived.\n\nFriendship and sufficient external goods complicate the picture of self-sufficient virtue. His discussions of contemplation and political life also leave tensions within the account of the best life. Modern readers need not accept his account of human function or the exclusions of his society to examine these arguments; borrowing them does not remove that critical task.',
      questions: ['Which activities make a life good rather than merely pleasant to remember?', 'Can character alone compensate for missing opportunities and material support?'],
      sourceIds: ['sep-aristotle'], readingIds: ['good-life'], prerequisiteIds: [],
    },
    {
      id: 'skepticism', title: 'Ancient skepticism: inquiry and suspension', kind: 'tradition', area: 'Ancient Mediterranean',
      summary: 'Academic and Pyrrhonian skeptics challenge premature assent while confronting the problem of how inquiry and action remain possible.',
      detailMd: 'Skepticism here means ancient practices of investigation, not indiscriminate modern cynicism. Pyrrhonian arguments set appearances or accounts against one another and may lead to suspension of judgment. Academic positions and Pyrrhonian approaches differ, including over tranquility and the guidance available for action.\n\nThe objection that suspension makes life impossible matters: skeptics answer in terms of the plausible, convincing, or apparent, with important differences between authors. **Uncertainty** borrows the distinction between acting and asserting a final truth, without claiming that modern risk management is Pyrrhonism.',
      questions: ['What claim am I suspending, and what practical appearances still guide me?', 'Would my demand for certainty also defeat beliefs I currently favor?'],
      sourceIds: ['sep-skepticism'], readingIds: ['trust', 'uncertainty'], prerequisiteIds: [],
    },
    {
      id: 'kant', title: 'Kantian ethics: duty and respect', kind: 'tradition', area: 'European Enlightenment',
      summary: 'Kant asks whether our principles can have universal authority and whether our actions respect persons rather than merely using them.',
      detailMd: 'A categorical requirement is not conditional on whichever desire happens to dominate. Kant’s universal-law and humanity formulas offer connected ways of articulating moral obligation. Autonomy is rational self-legislation, not simply permission to do whatever one prefers. These claims are controversial, especially in application.\n\nThe separate essay on enlightenment questions tutelage but preserves a historically specific distinction between public argument and obedience within an office. It should not be read as an instruction to refuse expertise or as a straightforward contemporary account of political freedom. In this pack, source-checking and respect for agency remain related but distinct questions.',
      questions: ['Can I justify the principle of my action without exempting myself?', 'Am I giving another person a genuine opportunity to understand and refuse?'],
      sourceIds: ['sep-kant', 'kant-enlightenment'], readingIds: ['trust', 'belonging', 'responsibility'], prerequisiteIds: [],
    },
    {
      id: 'utilitarianism', title: 'Utilitarianism: whose consequences count?', kind: 'tradition', area: 'British moral philosophy',
      summary: 'Classical utilitarians judge conduct by its contribution to overall well-being, challenging partiality while disagreeing about the character of happiness.',
      detailMd: 'Bentham and Mill both make consequences for sentient lives central, but Mill’s account of qualitative differences among pleasures departs from Bentham’s quantitative approach. Utilitarianism is not equivalent to every consequentialist theory, nor to whatever produces an immediate majority preference.\n\nImpartial aggregation can expose neglected suffering. It also faces objections concerning rights, burdens, demandingness, and the information needed to compare alternatives. **Responsibility** puts that dispute into a concrete decision without pretending that a single invented calculation settles the moral question.',
      questions: ['Whose welfare has disappeared from my account of the outcome?', 'Which burdens should not be imposed on one person for a larger total benefit?'],
      sourceIds: ['sep-utilitarianism'], readingIds: ['responsibility'], prerequisiteIds: [],
    },
    {
      id: 'pragmatism', title: 'Pragmatism: inquiry as a revisable practice', kind: 'tradition', area: 'American philosophy',
      summary: 'Peirce and Dewey examine how real problems initiate inquiry and how methods of testing differ from merely fixing belief by habit or authority.',
      detailMd: 'Pragmatists are not united by the slogan that convenient beliefs are true. Peirce connects meaning with conceivable practical consequences and challenges doubt that has no grip on actual belief. Dewey analyzes inquiry as transforming an indeterminate situation, not only rearranging propositions.\n\nFallibilism allows correction without requiring total skepticism. But calling a policy an experiment does not excuse exposing others to harm, and a pleasant outcome need not confirm the explanation offered for it. Our suggested records of expectations, observations, and revision are contemporary exercises inspired by these questions, not a canonical pragmatist procedure.',
      questions: ['What observable difference would follow if this explanation were mistaken?', 'Who helps define the problem, and who bears the cost of testing a solution?'],
      sourceIds: ['sep-pragmatism'], readingIds: ['trust', 'uncertainty'], prerequisiteIds: [],
    },
    {
      id: 'existentialism', title: 'Existentialism: freedom in a situation', kind: 'tradition', area: 'Modern European philosophy',
      summary: 'Existentialist inquiries ask how people take responsibility for lives already shaped by bodies, histories, institutions, and other people.',
      detailMd: 'The label covers religious and nonreligious writers, and substantial disagreements about freedom. Sartre’s positions changed; Beauvoir’s work foregrounds the material and social circumstances through which possibilities become available or blocked. Authenticity is therefore not adequately described as discovering a private preference.\n\nA reader can ask whether an inherited role is being lived responsibly or used to escape answering for choices. The reverse criticism matters too: celebrating choice can conceal dependency and unequal options. These tensions resist both fatalism and the claim that everyone can freely reinvent their life.',
      questions: ['Which limits are material, which are maintained by others, and which have I treated as inevitable?', 'Does my chosen freedom enlarge or restrict another person’s possibilities?'],
      sourceIds: ['sep-existentialism'], readingIds: ['belonging', 'responsibility'], prerequisiteIds: [],
    },
    {
      id: 'phenomenology', title: 'Phenomenology: describing lived experience', kind: 'tradition', area: 'Modern European philosophy',
      summary: 'Phenomenology studies how things are experienced: as meaningful, embodied, temporal, and directed toward a world, rather than as neutral inner pictures.',
      detailMd: 'Intentionality names the directedness of experience toward something; it does not mean a deliberate intention. A waiting room can appear as a place of threat, delay, or care through bodily orientation, expectation, and attention. Such description differs from immediately explaining an experience’s cause.\n\nHusserl’s bracketing is a technical method with disputed interpretations, not a promise that anyone can remove every assumption. The pack’s modest descriptive exercise asks readers to separate what appeared from the conclusions they drew. It cannot establish another person’s intentions or replace empirical investigation.',
      questions: ['How did the same place appear differently before and after the news?', 'What was in the background of my experience but still shaping it?'],
      sourceIds: ['sep-phenomenology'], readingIds: ['attention'], prerequisiteIds: [],
    },
    {
      id: 'confucian', title: 'Early Confucian thought: ritual and relationship', kind: 'tradition', area: 'Chinese thought',
      summary: 'Selected early Confucian materials ask how ritual, humane concern, and exemplary conduct cultivate people within family and political relationships.',
      detailMd: 'Li, often rendered ritual propriety, concerns practices through which dispositions and relationships take shape; ren involves humane concern. The Analects is a transmitted collection with a complicated history, not an unmediated transcript of a single author’s system. Later Confucian traditions cannot be inferred from this small selection.\n\nRole-specific duties can make otherwise invisible obligations legible, yet their hierarchy raises questions about dissent and unequal burdens. The source also records tensions between family and political responsibilities. Comparing this cultivation with Aristotle is an editorial invitation, not a claim that the traditions share one definition of virtue.',
      questions: ['What does this repeated practice teach its participants to notice?', 'Can a relationship’s duties be criticized from within without making obedience its highest value?'],
      sourceIds: ['sep-confucius'], readingIds: ['belonging', 'responsibility'], prerequisiteIds: [],
    },
    {
      id: 'daoist', title: 'Daoist thought: paths, distinctions, and responsiveness', kind: 'tradition', area: 'Chinese thought',
      summary: 'Laozi and Zhuangzi do not offer one interchangeable doctrine. This entry follows questions about learned paths and the limits of confident naming.',
      detailMd: 'The category Daoism was formed after the classical texts associated with Laozi and Zhuangzi. Chad Hansen’s encyclopedia interpretation emphasizes language, social practices, and the plurality of possible ways of proceeding. This is a situated interpretation, not a complete account of religious Daoism or a consensus reading of every passage.\n\nA distinction that helps us navigate can also make alternatives invisible. That observation invites criticism of rigid control without implying that every path is equally good or that neglect is wisdom. Our uses of these ideas in attention and uncertainty are explicit contemporary comparisons, not translations of a Daoist practice manual.',
      questions: ['Which distinctions help me respond, and which prevent me from seeing a possibility?', 'Where would less forcing require greater skill rather than less care?'],
      sourceIds: ['sep-daoism'], readingIds: ['attention', 'uncertainty'], prerequisiteIds: [],
    },
    {
      id: 'buddhist', title: 'Early Buddhist thought: suffering and appropriation', kind: 'tradition', area: 'Indian Buddhist thought',
      summary: 'Early teachings connect suffering with conditioned processes, craving, and treating changing aspects of experience as a secure self or possession.',
      detailMd: 'The early teachings preserved in Nikāyas and Āgamas are approached here through Mark Siderits’s reconstruction. Suffering is not simply the claim that every moment feels painful. The path toward its cessation includes ethical and liberative commitments; it cannot be reduced to improving concentration at work.\n\nNon-self is philosophically demanding and interpretively disputed, not the claim that people do not matter. Later Buddhist traditions develop many different analyses. The attention essay asks what happens when an uncomfortable feeling is appropriated as a verdict about oneself, without presenting that question as a full account of Buddhist practice.',
      questions: ['What changes when a passing feeling becomes a claim about who I essentially am?', 'Does reducing attachment alter care, and how could care remain demanding?'],
      sourceIds: ['sep-buddha'], readingIds: ['attention'], prerequisiteIds: [],
    },
    {
      id: 'nyaya', title: 'Nyāya: knowledge sources and trustworthy testimony', kind: 'tradition', area: 'Classical Indian philosophy',
      summary: 'Nyāya develops arguments about pramāṇas, sources of knowledge, including testimony understood through a knowledgeable and non-deceptive speaker.',
      detailMd: 'Nyāya accepts perception, inference, comparison, and testimony as knowledge sources, while other Indian schools disagree about their independence and scope. In the survey’s discussion of Gautama and Vātsyāyana, an āpta combines knowledge with a wish to communicate without deception; social prestige alone is insufficient.\n\nThe source distinguishes the acquisition of testimonial knowledge from later certification that a report is true. This is not merely a historical version of contemporary Western reductionism or non-reductionism. It belongs to wider debates about cognition, error, liberation, and the reality known; those debates exceed this entry point.',
      questions: ['Does this speaker know, and are they communicating what they know without deception?', 'Am I confusing how I learned something with how I would defend it if challenged?'],
      sourceIds: ['sep-nyaya'], readingIds: ['trust', 'uncertainty'], prerequisiteIds: [],
    },
    {
      id: 'islamic', title: 'Islamic philosophy: an entry through al-Fārābī', kind: 'tradition', area: 'Islamic / Arabic-language philosophy',
      summary: 'Al-Fārābī’s work connects logic, happiness, metaphysics, and political organization. It offers one demanding entry into a much wider intellectual world.',
      detailMd: 'A philosopher working in Arabic in the medieval Islamic world, al-Fārābī organized inquiries into language, logic, sciences, and the ends of political association. His hierarchical city is discussed alongside a hierarchical cosmology; how those arguments relate remains contested. Religion and philosophical understanding also pose questions of audience and education.\n\nDruart emphasizes the uneven evidence for his ethics, including a lost commentary and disagreements between interpretations. This entry is not a general account of Muslim beliefs, Islamic theology, or all falsafa. The modern question about institutions supporting good lives is an editorial extension, not an attribution of democratic commitments to al-Fārābī.',
      questions: ['What conception of happiness is built into the institutions that educate us?', 'Who gets to define intellectual excellence, and who can contest that authority?'],
      sourceIds: ['sep-farabi'], readingIds: ['good-life'], prerequisiteIds: [],
    },
    {
      id: 'african-relational', title: 'African relational philosophy: Gyekye’s Akan-centered account', kind: 'tradition', area: 'African / Akan philosophy',
      summary: 'Kwame Gyekye examines character, moral personhood, common good, and duties through an account substantially grounded in Akan language and thought.',
      detailMd: 'In this account, ethical personhood is a moral achievement expressed in conduct toward others, not merely a biological classification. Relational duties and the common good challenge a picture of the individual as complete before entering social life. Gyekye’s broad wording should itself be read critically, not treated as evidence that one philosophy speaks for a continent.\n\nThe distinction between ethical appraisal and basic human standing becomes crucial: calling conduct deficient must not become permission to withhold rights or exclude unfamiliar people. Our essays develop that objection as an editorial question. They do not equate Akan thought with every account of ubuntu, or collapse African philosophies into a single communal outlook.',
      questions: ['What do I owe because others helped make my agency possible?', 'How can a community judge conduct while preserving the standing of dissenters and outsiders?'],
      sourceIds: ['sep-african-ethics'], readingIds: ['belonging', 'responsibility'], prerequisiteIds: [],
    },
  ],
  readings: [
    {
      id: 'trust', title: 'Trust without surrender',
      question: 'When should I rely on another mind?',
      standfirst: 'Knowing for yourself rarely means knowing by yourself. Begin with one claim you depend on, and ask what a responsible dependence would require.',
      bodyMd: `A friend recommends a doctor. A colleague explains why the budget will not cover another person. A relative remembers an event differently from you. In each case, another mind offers access to something you cannot simply inspect. Refusing every such offer would not make you independent. It would leave you unable to use much of your language, history, medicine, or practical knowledge. Yet accepting every offer would expose you to error and manipulation. The important question is therefore not whether to depend, but how to remain answerable for a belief whose grounds you do not entirely possess.

Start by separating three questions that easily collapse. Is the claim true? Is this person a good source about it? What relationship am I entering by relying on them? A person can report a truth accidentally, know something while refusing to explain it, or care about you while being mistaken. Trusting a friend’s intentions is not the same as accepting their diagnosis. Conversely, checking a diagnosis need not accuse the friend of dishonesty. Naming the object and extent of reliance can make scrutiny less personal and more precise.

Contemporary epistemology of testimony offers a real disagreement here. Reductionist approaches require positive reasons for regarding a speaker as reliable. That demand seems sensible when someone makes an unfamiliar claim with serious consequences. But where do those reasons come from? Credentials, records, and corroboration often reach us through further testimony. If every report had to be justified without depending on any other report, ordinary knowledge would be threatened. Non-reductionist approaches therefore allow some initial entitlement to accept testimony, while leaving room for defeating reasons. This is not a license to believe everything; it disputes where the burden of justification begins.

Nyāya supplies a distinct line of inquiry rather than an ancient duplicate of that debate. In the source’s account of Gautama and Vātsyāyana, a trustworthy speaker, an āpta, knows and wants to communicate without deception. Competence and sincerity are separate requirements. The account also distinguishes receiving testimonial knowledge from subsequently certifying it when challenged. That distinction helps expose a mistake in everyday arguments: being unable to reconstruct a specialist’s proof does not establish that you learned nothing. It also leaves a difficult question intact: how can someone outside a field recognize its knowledgeable and honest speakers?

One answer is to examine how a claim can be corrected. Does the person distinguish observation from inference? Can they identify the limits of their expertise? Is disagreement allowed to reach them? These are fallible clues, not guarantees. A careful speaker can be wrong, and a socially awkward one can be right. An institution’s impressive procedures may be decorative. Still, asking where correction could enter often reveals more than asking whether a voice sounds certain. The practical object becomes a relationship to evidence, not a personality contest.

Kant’s essay on enlightenment adds a different worry: dependence can become tutelage when someone else’s direction replaces the exercise of one’s understanding. It would be a mistake to turn this into a ban on expertise. His own distinction between public reasoning and reasoning within an entrusted office is historically specific and politically restrictive. But his challenge can provoke a useful question today: am I borrowing someone’s competence while retaining permission to question, or borrowing their authority to escape responsibility? Those two arrangements may look identical until disagreement becomes costly.

Consider a repair estimate you cannot technically evaluate. You might obtain another explanation, ask which findings would change the recommendation, or authorize only a reversible first step. The amount of checking should respond to stakes, urgency, and available alternatives. Demanding exhaustive evidence before a trivial decision wastes attention; refusing verification before an irreversible one may transfer avoidable danger to others. This calibration is an editorial proposal, compatible with fallibilist inquiry, not a formula that the philosophers cited here jointly endorse. Even deciding what counts as a serious stake can require listening to another person.

Suspicion also distributes costs. A listener who demands exceptional proof only from people with unfamiliar accents is not being uniformly rigorous. A powerful professional who refuses any explanation may exploit a patient’s dependence. Fair scrutiny must examine the listener’s habits and the conditions of speaking, not only the speaker’s record. This can change the inquiry itself. What began as “Can I trust them?” may become “Why do I treat disagreement as disloyalty?” or “Who has to work hardest to be heard?” Neither branch is a distraction from philosophy.

For now, choose one reliance you can describe without judging a whole person. State the claim, the domain, the reasons available, and what would make you reconsider. Then ask whether you have offered the speaker a fair account of your uncertainty. You may end with conditional acceptance rather than confidence, or with a request for help rather than a verdict. Responsible dependence does not promise that you will never be deceived. It aims to make room for correction without pretending that you could first step outside the social world that makes knowing possible.`,
      counterpointMd: 'Demanding visible accountability can favor large institutions and polished experts over people whose knowledge is informal or whose safety depends on withholding details. Conversely, a presumption of trust can protect authority from challenge. The hardest case is not choosing between credulity and cynicism, but deciding who owes which explanation under unequal conditions. Defend a threshold for one actual decision, then test whether you would apply it to a speaker you already admire.',
      prompts: {
        reflection: 'Choose one claim from a friend, clinician, colleague, or, optionally, an AI-safety report. Separate your reasons to believe the claim from your feelings about the speaker, and name what is at stake.',
        argument: 'Argue for or against requiring positive evidence of reliability before accepting this particular claim. Present the strongest objection from someone who thinks your threshold is unfair or impractical.',
        revision: 'Return to an earlier judgment about a source. Preserve it, then write a revision naming one new reason, one unchanged commitment, and a specific condition under which you would revise again.',
      },
      nodeIds: ['testimony', 'nyaya', 'skepticism', 'kant', 'pragmatism'],
      sourceIds: ['sep-testimony', 'sep-nyaya', 'sep-skepticism', 'kant-enlightenment', 'sep-kant', 'sep-pragmatism'],
      minutes: 12,
      sourceNotes: 'Original editorial argument and invented everyday examples. Leonard, sections 1 and 5, supplies the testimony debate; Phillips and Vaidya, section 6, distinguishes Nyāya’s account and certification. Kant’s linked opening and public/private-reason paragraph motivate, but do not settle, the autonomy question. Vogt on action under suspension and Legg/Hookway on inquiry support the fallibilist comparison. The access checks and limitations are recorded per source; practical thresholds and the fairness objections are our extensions, not verified historical prescriptions.',
    },
    {
      id: 'belonging', title: 'The terms of belonging',
      question: 'What do I owe a community that has helped make me who I am?',
      standfirst: 'A place can give you language, memory, and care while asking you to become someone you cannot endorse. Belonging is neither simple obedience nor a choice made from nowhere.',
      bodyMd: `At a family meal, someone repeats a story about who you have always been. Everyone laughs with affection. You recognize the child in the story, but not the adult identity it now seems to assign you. Later, an expectation arrives almost without being spoken: attend, help, agree, keep the peace. It is tempting to describe the situation as a contest between a free individual and an intrusive group. Yet the language in which you resist, and perhaps the confidence that resistance is possible, were partly learned through relationships. The group is not simply outside you. That makes its claims harder, not automatically stronger.

A serious argument for belonging begins with this dependence. People do not arrive fully formed and then decide whether social life is useful. They learn capacities through care, correction, shared work, and examples. Some obligations may therefore precede explicit promises. The friend who sat with you through illness does not need a contract before asking to be heard. But dependence alone cannot settle what is owed. A history of care is real; an unlimited debt does not follow. Otherwise the people who enabled your agency could permanently own its exercise.

Early Confucian materials offer one way to think beyond this opposition. Ritual propriety, li, is not merely a decorative shell around authentic feelings. Repeated forms can educate attention and dispositions: how a guest is received, how mourning is expressed, how someone with less status is addressed. Humane concern, ren, gives these practices ethical depth. On this view, relationship is not only an obstacle to an already complete self. It is part of moral formation. The inherited form can make care possible before spontaneous affection is available.

That argument needs its own resistance. A ritual can also teach silence, distribute service unequally, or protect rank from criticism. The source’s account of early Confucian texts includes tensions among family duties and political duties; it does not give us a single timeless formula for obedience. A contemporary reader might ask what a practice actually cultivates and in whom. Does it train everyone to notice another’s needs, or train some to serve while others expect service? This is an editorial question addressed to the tradition, not a claim that its ancient setting already contained our answer.

Kwame Gyekye’s Akan-centered discussion makes a related but distinct challenge to the isolated individual. Moral personhood concerns character realized in relations and duties, not simply possession of a human body. The common good is not exhausted by a collection of private satisfactions. Someone’s generosity can sustain a world in which others become capable of generosity too. But Gyekye’s broad discussion of African ethics must not be mistaken for a report of one view shared across a continent. Here it is a particular philosophical account with language, history, and arguments that deserve direct scrutiny.

Its strongest difficulty may be the position of the dissenter. If admirable personhood is judged through communal practices, what protects someone who questions those practices? There is a crucial difference between criticizing conduct and denying someone basic standing. A community can say that a member acted selfishly without deciding that the member no longer counts. An outsider may also reveal a failure that familiar members have learned not to see. A relational account becomes more convincing when its description of mutual dependence opens obligations toward vulnerable strangers, rather than making existing acceptance the price of moral consideration.

Existentialist accounts of situated freedom sharpen the other side. Beauvoir’s attention to material and social conditions makes freedom more demanding than the instruction to choose your own identity. Choices are made from possibilities that others can expand or obstruct. Still, an inherited role cannot fully answer for what one does with it. Saying that a family or profession has always acted this way may explain a decision without justifying it. The challenge is to acknowledge what formed you without presenting formation as fate, and to acknowledge freedom without pretending everyone has equal room to leave.

A Kantian question introduces another test: does this arrangement respect each participant as someone whose agency matters, or merely as a useful bearer of a role? The test does not tell you that every inconvenient obligation is oppressive. Care often asks for work one would rather avoid. It does ask whether reasons can be exchanged, whether refusal is possible, and whether burdens are justified to those carrying them. Compare the demand to help a relative with the demand never to criticize a relative. They may sound like the same loyalty while protecting very different goods.

Your inquiry need not conclude with staying or departing. You might distinguish a relationship you want to sustain from a practice you want to change. Name a debt that feels genuine, a demand you reject, and the reasons someone else might contest that distinction. Perhaps the next question is about loneliness, migration, faith, language, or the right to disappoint. Those branches need not be brought back under the original family story. A defensible belonging may include disagreement about its own terms, and some communities may refuse those terms. Philosophy cannot guarantee reconciliation where the available relationships will not permit it.`,
      counterpointMd: 'Making every obligation depend on a present opportunity to consent can erase the unchosen work through which people are cared for. Yet celebrating unchosen duties can conceal domination and make departure materially impossible. The issue is not whether all roles are good or bad: identify a duty that should survive your preference to avoid it, and explain why its justification would not authorize every demand made in the same relationship.',
      prompts: {
        reflection: 'Describe one communal practice twice: first from the position of someone it supports, then from the position of someone who bears its hidden work. Mark what you cannot know without asking.',
        argument: 'Defend one unchosen obligation you think is genuine. State its limit and answer an objection from a person who would be asked to carry more of its cost than you.',
        revision: 'Revisit an earlier account of loyalty or independence. Keep the original, then distinguish one relationship you want to preserve from one practice you would change, explaining what altered your view.',
      },
      nodeIds: ['confucian', 'african-relational', 'existentialism', 'kant'],
      sourceIds: ['sep-confucius', 'sep-african-ethics', 'sep-existentialism', 'sep-kant'],
      minutes: 12,
      sourceNotes: 'The meal and subsequent questions are original editorial examples. Csikszentmihalyi, sections 3–5, supports ritual cultivation and competing roles; Gyekye, sections 4 and 7–9, supports the account of moral personhood and duties. Their juxtaposition is not an equivalence or an influence claim. Aho, section 4.2, informs situated freedom; Johnson/Cureton, section 6, informs respect. The analysis of exclusion, exit, and unequal work is an editorial challenge to these accounts, not a claim that they all reach the same conclusion.',
    },
    {
      id: 'attention', title: 'Before the verdict',
      question: 'How does the way I attend change what I take to be happening?',
      standfirst: 'Attention does more than allocate a scarce resource. It shapes what becomes salient, how another person appears, and which interpretation reaches you first.',
      bodyMd: `You send a difficult message and receive no reply. At first there is only an empty interval. Soon it becomes evidence: you have offended someone, they are avoiding you, the relationship was less secure than you thought. Nothing visible has changed, but the situation now has a different texture. Your attention returns to particular words in the message, ignoring other possibilities. This does not prove that the interpretation is false. Sometimes silence really is a refusal. It shows instead that experience and judgment are entangled before you consciously decide what to believe.

One response is to treat attention as a productivity problem. Remove distractions, concentrate, complete the task. That can be useful, but concentration by itself does not distinguish understanding from fixation. You can become highly efficient at gathering evidence for a mistaken suspicion. The philosophical question is not only how steadily you look, but what your looking is organized around. A person awaiting reassurance may notice hesitation as danger; the same person, engaged in another activity, may not register it at all. Neither description yet tells us which response is justified.

Phenomenology offers a disciplined interest in this difference. It examines how things are experienced, including the directedness called intentionality and the bodily and temporal structures through which a world appears. Intentionality here does not mean that every experience is deliberate. Waiting can be directed toward an expected reply even when you wish to think about something else. A modest writing experiment is to describe the scene before explaining its cause: the impulse to check, the narrowing of possibilities, the way each minute seems to confirm the last. That experiment borrows a descriptive orientation; it is not the full technical method of Husserl.

Description creates a pause, but not a guarantee of truth. You may describe your experience carefully and still mistake another person’s motives. Nor does the first-person perspective exhaust what is happening. A friend who knows the other person is caring for a sick parent may understand the silence better than you do. Phenomenological attention is useful here because it reveals the structure of your confidence, not because it grants private experience final authority. The distinction between what appeared and what follows from it remains essential.

Early Buddhist teachings introduce a different question about the episode. In the reconstruction used here, suffering is connected with conditioned processes, craving, and appropriation as “I” and “mine.” The silence becomes not merely uncomfortable but a verdict about a supposedly stable self: I am unwanted; my standing must be secured. This is not a claim that every painful response is a personal mistake. Nor is Buddhist thought a technique for making difficult conditions tolerable while leaving them unchanged. Its ethical and liberative setting is larger than attention management, and later traditions develop different analyses of self and experience.

A Stoic approach would focus on assent and valuation. An impression arrives, but its arrival need not settle what is good or bad, or how to respond. The school’s demanding claim that virtue alone is good shifts the stakes of reputation and approval. That claim is stronger than the contemporary advice to delay a reply when upset, and a reader may reasonably reject it. The distinction between involuntary reactions and judgments nevertheless matters. Ancient Stoic discussions of good feelings also resist the caricature that a responsible person should become emotionally blank. A feeling can be acknowledged without making it the sole judge of an event.

Daoist texts, approached through Chad Hansen’s interpretation, complicate the urge to impose one reliable classification. Learned names and paths help us proceed but can also conceal alternatives. Once silence has been named rejection, subsequent details may be forced into that path. A different way of responding could emerge through attention to the situation rather than increased control of it. This comparison is editorial: Daoist discussions of language and skilled responsiveness are not the same project as Stoic assent or Buddhist liberation. They need not be translated into one universal lesson about mindfulness.

There is a forceful objection to all this inward scrutiny. A person facing recurrent neglect may be encouraged to reinterpret everything rather than confront the neglect. Attention then becomes accommodation. To avoid that, ask what observation would support an external criticism, not only what internal habit might change. Compare a single delayed message with a persistent pattern of evasion after a clear agreement. Ask whether calmer observation leads to better evidence, a firmer boundary, or an honest conversation. The aim is not to make the original discomfort disappear at any cost.

Try keeping two accounts of one small episode: what was available to perception, and what you took it to mean. Let the accounts remain connected but not identical. You may discover that the next inquiry concerns anger, recognition, time, or a relationship’s demands rather than attention itself. You may also decide that your first judgment was substantially right. The gain would then be knowing why it stands, and which alternatives were considered, rather than earning praise for serenity. Attention becomes philosophically useful when it opens the world to correction, including correction of the hope that looking differently will solve everything.`,
      counterpointMd: 'The demand to observe before judging can be unfair when people have repeatedly had their accounts of mistreatment dismissed. Immediate recognition can carry knowledge acquired through experience. The alternative to both reflexive judgment and endless self-doubt is to ask what evidence, patterns, and stakes distinguish this occasion. A pause is a possible method, not a moral requirement to remain in an unsafe or degrading situation.',
      prompts: {
        reflection: 'Describe a recent ordinary misunderstanding using two headings: what appeared, and what I inferred. Include bodily or temporal details without diagnosing yourself or another person.',
        argument: 'Defend either a quick judgment or a delayed judgment in that case. Explain why your preferred method would reveal rather than conceal an external problem.',
        revision: 'Keep the first description and add a second after considering one alternative explanation. Identify which details changed significance, which did not, and what you still cannot infer.',
      },
      nodeIds: ['phenomenology', 'buddhist', 'stoicism', 'daoist'],
      sourceIds: ['sep-phenomenology', 'sep-buddha', 'sep-stoicism', 'sep-daoism'],
      minutes: 12,
      sourceNotes: 'An original invented message scenario carries an editorial comparison, not a shared doctrine. Smith, sections 1–2 and 4, informs description and intentionality; Siderits, sections 2–3, informs suffering and appropriation; Durand/Shogry/Baltzly, sections 3.7 and 4.7, informs assent and feelings. Hansen, sections 7–10, supplies one interpretation of paths and naming. The writing exercise is not a reconstruction of a complete philosophical method, a clinical intervention, or evidence that these traditions recommend the same practice.',
    },
    {
      id: 'good-life', title: 'A life worth its costs',
      question: 'What would make my life good, rather than merely successful?',
      standfirst: 'Pleasure, excellence, integrity, friendship, and public purpose can pull in different directions. A real choice makes the disagreement harder to hide.',
      bodyMd: `Imagine being offered work you once wanted badly. It brings recognition, money, and a chance to exercise abilities that have been underused. It also requires leaving people with whom your days have acquired a reliable shape. Neither accepting nor refusing looks obviously foolish. Calling the choice a question of balance may simply rename the difficulty. What are you balancing, and why should those things count? A list of preferences will not settle whether some preferences deserve criticism. Before choosing between two lives, you may need to ask what makes either life worth wanting.

Aristotle gives a demanding answer: flourishing is an activity of living well, not just an agreeable inner state or a favorable report from spectators. Excellence of character and practical judgment shape how someone acts across circumstances. This matters for the offer because a prestigious role might exercise real abilities while encouraging pettiness or deception. Alternatively, refusing it might preserve comfort while avoiding a valuable challenge. The question is not whether ambition is inherently good or bad, but what kind of activity it organizes and what dispositions its repetition develops.

This approach does not make fortune irrelevant. Friendship and sufficient external resources matter in Aristotle’s account, and the best life cannot be read directly from a résumé of personal virtues. Someone deprived of basic security has not simply failed to choose well. There is also a problem within the appeal to human excellence: who decides which capacities are central, and why should excellence in them define a life’s good? Aristotle’s function argument is an argument to examine, not a fact a modern reader must accept. His discussions of contemplative and political lives complicate any easy picture of one harmonious package.

Epicurus changes the direction of questioning. Perhaps the offer’s greatest attraction is relief from the fear of being overlooked. If so, will recognition satisfy the desire or create a new audience whose approval must be secured? The distinction between natural necessary desires, natural unnecessary desires, and empty desires asks whether a pursuit has a workable limit. Pleasure in this account is not an endless succession of luxuries. Freedom from pain and disturbance, supported by friendship and a less anxious relation to desire, gives a different measure of enough. Refusal could therefore be intelligent rather than timid.

But this argument also faces a serious objection. A difficult project may be worth its frustration. Raising a child, making art, or defending an institution can involve uncertainty that no secure pleasure could replace. Does tranquility undervalue commitments whose meaning includes exposure to loss? An Epicurean can answer that the objector mistakes unnecessary agitation for depth, and that some pains are chosen for a better life. Still, the disagreement is genuine. We should not erase it by saying that every tradition really means to pursue whatever makes a person feel fulfilled.

The Stoics offer another challenge: virtue, rather than pleasure or external achievement, is the good that makes a life happy. Money and professional standing may be reasonably selected, but they cannot determine moral worth or happiness in the strict Stoic account. The offer then becomes a circumstance in which to act well, not the final judge of whether your life succeeds. That can defend someone against humiliation by fortune. It can also sound too severe. If health, friendship’s continued presence, or freedom from oppression does not improve a life as a genuine good, has the account preserved agency by narrowing the meaning of happiness too far?

An entry through al-Fārābī moves the discussion beyond a private selection of lifestyles. His work connects intellectual activity, happiness, and political organization, with a hierarchical ideal city discussed alongside a hierarchical account of reality. This is not a medieval version of a modern career guide or a democratic public-service ethic. The evidence for parts of his ethics is limited and interpretation remains contested. Yet his project invites an important contemporary question: what institutions teach us to desire, and what conception of a good life do their rewards assume? Your offer belongs to a social arrangement, not only to your personality.

That question changes the alternatives. You might discover that both accepting and refusing leave an objectionable arrangement intact, while collective negotiation could change its terms. Or the institution may claim to serve a public purpose while relying on invisible, poorly rewarded work. Asking about a good life then involves those whose lives support your options. This is our editorial extension, not a conclusion jointly endorsed by Aristotle, Epicurus, the Stoics, and al-Fārābī. Their disagreements over pleasure, virtue, external goods, and political order remain unresolved and useful.

Instead of ranking whole philosophies, describe the concrete goods each option protects and the losses it cannot repair. Name one sacrifice you would regard as honorable and another you would regard as needless, then defend the difference. Your question may branch toward money, vocation, friendship, disability, or the kind of parent or neighbor you want to become. You need not adopt a final account of happiness before noticing that a familiar measure of success is inadequate. But noticing inadequacy is only the beginning: a new measure must also survive criticism from the people who bear its costs.`,
      counterpointMd: 'A unified theory of the good life may demand too much order from lives shaped by incompatible loves and unequal opportunities. Perhaps the best judgment is local and plural rather than governed by a single highest good. The opposing worry is that pluralism can conceal unexamined convention: if every valued pursuit counts equally, we lose the language to criticize destructive ambitions. Test both positions against one sacrifice rather than against an idealized whole life.',
      prompts: {
        reflection: 'Choose a live or past decision. List its goods without reducing them to money or mood, and identify whose labor or care made each option possible.',
        argument: 'Defend one criterion for a good decision using Aristotle, Epicurus, Stoicism, or the institutional question raised through al-Fārābī. Answer the strongest objection from a different entry point without claiming the positions agree.',
        revision: 'Preserve your first account of success. Write a revised account after removing one measure you inherited without examination; explain what would be lost if everyone used your replacement.',
      },
      nodeIds: ['aristotle', 'epicureanism', 'stoicism', 'islamic'],
      sourceIds: ['sep-aristotle', 'sep-epicurus', 'sep-stoicism', 'sep-farabi'],
      minutes: 12,
      sourceNotes: 'The offer and its alternatives are invented editorial examples. Kraut on function, practical judgment, friendship, and competing lives; Konstan on desires and pleasure; and Durand/Shogry/Baltzly on virtue and indifferents support the disagreements. Druart, sections 6–7, supports the carefully limited account of al-Fārābī’s city and happiness and notes evidential gaps. The modern institutional questions are our extension. No primary edition of al-Fārābī was checked, and no uniform “Islamic conception of happiness” is asserted.',
    },
    {
      id: 'responsibility', title: 'Answering for what happens next',
      question: 'What am I responsible for when my choices affect other people?',
      standfirst: 'Good intentions, good outcomes, fair principles, and existing relationships can disagree. Responsibility begins where none of them can simply stand in for the others.',
      bodyMd: `You coordinate a small project and discover a mistake in information already sent to several people. Correcting it immediately would embarrass a colleague who supplied the figures and may delay work that others badly need. Waiting could allow a decision to proceed on false assumptions. You did not invent the error, but you did circulate it. The colleague asks for a little time. There is no option in which you cease to affect anyone. Even silence would help determine what happens next. Responsibility therefore cannot mean merely identifying the person whose intention was worst.

It helps to separate questions that a single word can obscure. Who caused the problem? Who knew enough to prevent it? Who now has the ability or authority to repair it? Who deserves blame? The answers can differ. A person who innocently passes on an error may owe a correction without deserving the condemnation appropriate to deception. Someone who caused nothing may nevertheless have a special capacity to help. Keeping these distinctions visible avoids two shortcuts: treating every obligation as proof of guilt, and treating absence of guilt as release from every obligation.

A Kantian approach asks about the principle of the action and respect for the people affected. Could you justify concealing relevant information simply because disclosure would inconvenience your own group? Are recipients being used as instruments for a plan they cannot evaluate? The concern is not only that concealment may backfire. It is that another person’s capacity to decide matters even when the result would be more convenient if they remained uninformed. A duty to correct can thus stand against a tempting calculation of immediate benefits.

Yet a rule described too crudely can ignore morally relevant differences. Announcing every uncertain detail to everyone may reveal private information, spread confusion, or create a misleading impression of certainty. Respect is not accomplished by maximal disclosure without judgment. A careful Kantian argument must identify the actual maxim and those to whom explanation is owed; the theory is not exhausted by repeating that one must never lie. In the project case, it might matter whether you can pause reliance on the figures while checking them, without publicly assigning blame before you know the facts.

Utilitarian reasoning makes a different demand: count consequences for everyone affected, not only the people whose embarrassment you can see. How many decisions depend on the figures? How serious would the damage be? What harms follow from delay? Classical utilitarians also disagree about the character of well-being, as Bentham’s and Mill’s accounts of pleasure illustrate. No convenient number removes those difficulties. Nevertheless, the demand to include distant and quiet sufferers is powerful. Your loyalty to a colleague can make a small local discomfort vivid while leaving a larger external harm strangely unreal.

The strongest objection is not that consequences never matter. It is that aggregation may permit imposing a severe burden on one person for a sufficiently large benefit to others. Defenders can reply that stable rights and reliable practices themselves have valuable consequences. Critics can ask whether those protections remain secure when an exceptional case promises greater gains. The project offers a modest version of this dispute: would you expose a colleague’s private circumstances to improve confidence in your correction? A favorable overall effect does not obviously settle what you are entitled to disclose.

Role-based and relational accounts add obligations that neither an isolated intention nor an anonymous total fully describes. Early Confucian materials examine duties within relationships and the conduct through which those relationships are cultivated. Gyekye’s Akan-centered account emphasizes common good and responsibilities arising from social life. These are distinct projects, not a single communal alternative to Western individualism. In this example, they invite attention to what a coordinator, colleague, or trusted messenger specifically owes. A relationship may require patient correction rather than public humiliation, while still requiring correction. But roles can also conceal unfair distributions of sacrifice.

Existentialist discussions of situated freedom challenge the excuse that the role made the decision for you. Procedures, employment conditions, and authority constrain what is possible; pretending otherwise can blame people for options they never had. Still, where alternatives exist, “that is how things are done” does not justify choosing one. Beauvoir’s attention to social constraint makes the question less theatrical than a solitary act of will. Can you change the conditions under which others decide, rather than merely announce your own innocence? A repair may involve a clearer process, shared scrutiny, or protection for people who report mistakes.

Try writing the decision from the position of three affected people, including someone absent from the conversation. Distinguish what each needs to know from what you merely want them to think about you. Then propose an action, its reasons, and the harm it cannot entirely avoid. You might notify recipients not to rely on the disputed figures, investigate promptly, and agree on a correction without disclosing irrelevant personal details. That is an example to contest, not a solution guaranteed by the theories. The inquiry can continue into apology, collective responsibility, professional loyalty, or the difference between accepting blame and making repair.`,
      counterpointMd: 'Responsibility framed around the person able to help can repeatedly burden the most conscientious or least powerful participant. Repair should not erase the causal responsibility of others or substitute private sacrifice for institutional change. At the same time, refusing help until blame is perfectly allocated may let preventable harm continue. Explain a temporary repair obligation and a longer-term redistribution of responsibility separately.',
      prompts: {
        reflection: 'Map a small shared failure without names: who caused it, who knew, who could repair it, and who was affected? Note where those categories do not coincide.',
        argument: 'Defend a response to that failure using either respect for agency or consequences for everyone affected. Then write an objection from the other approach and from a person carrying an unequal relational duty.',
        revision: 'Return to a previous account of blame. Preserve it and add a plan that distinguishes immediate repair from future prevention, stating which responsibility should be shared rather than silently accepted by one person.',
      },
      nodeIds: ['kant', 'utilitarianism', 'confucian', 'african-relational', 'existentialism'],
      sourceIds: ['sep-kant', 'sep-utilitarianism', 'sep-confucius', 'sep-african-ethics', 'sep-existentialism'],
      minutes: 12,
      sourceNotes: 'The project and proposed response are original editorial constructions. Johnson/Cureton, sections 2–7, and Driver, introduction and sections 2.2–2.3, ground the duty/consequence contrast. Csikszentmihalyi and Gyekye inform distinct discussions of roles and relations, not a homogeneous cultural position. Aho, section 4.2, informs situated freedom. The distinction between causation, blame, capacity, and repair is an editorial organizing device here, not attributed as a complete theory to any source.',
    },
    {
      id: 'uncertainty', title: 'Deciding without a final view',
      question: 'How can I act responsibly while leaving my conclusions open?',
      standfirst: 'An unfinished inquiry need not stop a life. The challenge is to distinguish honest suspension, practical commitment, and convenient refusal to know.',
      bodyMd: `A decision approaches before your understanding feels complete. You might move to another city, join a project, or change how you care for an aging relative. More information would help, but some of what matters can be learned only after acting. Advice points in different directions. Waiting preserves an option while quietly consuming another: money, time, someone’s patience, an available place. The wish to become certain before deciding begins to look less like caution and more like a demand the situation cannot satisfy. Yet urgency alone does not make any choice responsible.

First distinguish uncertainty about facts from uncertainty about values and from uncertainty about yourself. You may not know the rent, may disagree about how much proximity to family should matter, or may be unsure whether you want the life you describe. Research can clarify the first without settling the others. A spreadsheet can also conceal a value judgment by assigning it a number. Naming the kind of uncertainty prevents an endless search for information from substituting for a difficult argument about what deserves priority. It also helps identify which person might be able to help.

Ancient skepticism offers more than the declaration that everything is doubtful. Academic and Pyrrhonian approaches investigate claims and challenge unwarranted assent in different ways. Pyrrhonian suspension, arising through opposing accounts or appearances, need not be a dogmatic belief that truth is unattainable. The familiar objection is practical: if one does not settle what is true, how can one do anything? The ancient responses appeal to what is plausible, convincing, or apparent, depending on the author. Those responses remain disputed, but they reveal an important distinction between a final assertion about reality and the guidance involved in proceeding through a day.

That distinction does not make indecision a virtue. If another person needs an answer, withholding commitment has consequences too. Nor does suspension require granting equal credibility to every claim. You can judge some evidence substantially better while admitting that it leaves questions unresolved. A useful personal record might separate “I believe this is most likely” from “I am committing to this course now.” The commitment can be justified by limited time or the cost of alternatives without pretending that the belief has become certain. This is a contemporary adaptation, not a translation of Pyrrhonian practice into decision theory.

Pragmatist inquiry challenges another escape: doubt that is announced but never permitted to affect conduct. Peirce resists the pretense of doubting everything at once. Dewey treats inquiry as work on an indeterminate situation, where clarifying the problem is already an achievement. A question such as “Will moving make me happy?” may be too broad to guide investigation. Asking whether a different arrangement of work and care would reduce a specific conflict yields possible observations. That does not prove happiness is measurable or that every important commitment can be rehearsed. It makes one uncertainty available for examination.

An experiment should therefore name both its promise and its limits. A visit could reveal a commute without revealing what it means to leave a community. A temporary work arrangement could test a schedule without testing a permanent loss of status. Write what you expect to observe, what would count against the proposal, and who bears the cost of trying it. Otherwise, “experiment” can become a flattering name for making other people absorb your indecision. Reversibility matters, but it is rarely equal for everyone. One person’s easy return may leave another person with work that cannot be undone.

Nyāya adds a challenge to vague declarations of fallibility. Which knowledge source is operating, and what would make it defective in this case? In the surveyed account, receiving testimony and certifying its truth are not the same operation. You can take an informed report seriously while investigating a specific reason to doubt it. This suggests a more disciplined question than “What if everyone is wrong?” Ask whether the witness had access, whether an inference depends on an unsupported step, or whether contrary information has been ignored. These practical examples are ours; Nyāya belongs to a broader philosophical setting than a checklist of evidence.

A Daoist comparison, following Hansen’s interpretation, draws attention to the categories defining your options. Perhaps the choice has been named success versus failure, or loyalty versus betrayal, when those labels already contain the answer. Another description might reveal a path you had excluded. That does not show that distinctions can be abandoned or that every available path is equally defensible. It asks whether confident naming is doing work that observation and argument ought to do. Daoist discussions of paths and language are not an early form of pragmatism, even when a modern reader finds a productive question between them.

Finally, decide what would reopen the inquiry. A date can help, but so can a change in circumstances or a piece of evidence that matters. A provisional decision is not automatically provisional in practice: people protect earlier choices, stop asking, and reinterpret every outcome as vindication. Keeping the original reasons visible makes revision more than a new story about always having known. You may conclude that a question should rest because its urgency has passed, not because it has been solved. Your next inquiry might concern grief, courage, patience, or the demands of a promise. Leaving the conclusion open should preserve an honest route back, not require you to live forever at the threshold.`,
      counterpointMd: 'Provisionality can become a privilege: the person who keeps all options open may force others to commit first. Sometimes a promise properly limits later revision even when preferences change. Conversely, honoring a commitment need not require denying new evidence or tolerating harmful conditions. State which part of a decision is a revisable belief, which part is a promise to others, and how those two can be renegotiated without being confused.',
      prompts: {
        reflection: 'Take one unresolved decision and separate unknown facts, contested values, and uncertainty about your own wishes. Identify an unanswered question in each category without forcing a conclusion.',
        argument: 'Defend acting now or waiting in that case. Specify the evidence threshold, the cost of delay, who bears the cost of an experiment, and the strongest objection to your choice.',
        revision: 'Preserve your present reasons before acting. Later, compare them with what occurred, naming one mistaken expectation, one surviving reason, and whether you are revising a belief, a commitment, or both.',
      },
      nodeIds: ['skepticism', 'pragmatism', 'nyaya', 'daoist', 'testimony'],
      sourceIds: ['sep-skepticism', 'sep-pragmatism', 'sep-nyaya', 'sep-daoism', 'sep-testimony'],
      minutes: 12,
      sourceNotes: 'Original editorial scenarios and procedures. Vogt, sections 1 and 3–4, supports the ancient suspension/action problem; Legg/Hookway, sections 4.1–4.2, supports real doubt and inquiry; Phillips/Vaidya, sections 1–3 and 6, supports knowledge sources and certification. Hansen, sections 7–10, motivates a comparison about framing, not a historical connection to pragmatism. Leonard supplies the background testimony distinction. The proposed experiment and reopening conditions are practical extensions, not empirically validated learning methods.',
    },
  ],
  relations: [
    {
      from: 'testimony', to: 'nyaya', kind: 'explores',
      explanation: 'Editorial comparison (not a historical influence claim): Leonard’s debate over testimonial justification and Phillips/Vaidya’s account of Nyāya both make dependence on speakers philosophically serious. Nyāya’s knowledgeable, non-deceptive āpta and its distinction between acquisition and certification should not be forced into the contemporary reductionist/non-reductionist division.',
      sourceIds: ['sep-testimony', 'sep-nyaya'],
    },
    {
      from: 'testimony', to: 'skepticism', kind: 'contrasts',
      explanation: 'Editorial comparison (not a historical influence claim): Leonard asks how another person’s report can justify belief; Vogt describes ancient challenges to assent and responses to the problem of acting under suspension. Together they sharpen the difference between questioning a particular report and demanding a basis that would make all ordinary knowledge impossible.',
      sourceIds: ['sep-testimony', 'sep-skepticism'],
    },
    {
      from: 'testimony', to: 'kant', kind: 'explores',
      explanation: 'Editorial comparison (not a historical influence claim): the epistemology of expertise and Kant’s challenge to tutelage raise different aspects of dependence. The testimony entry concerns justification; the enlightenment essay concerns exercising understanding and public reasoning. Reliance on competence need not mean surrender of agency, but that contemporary conclusion is an invitation to argue, not a quoted doctrine.',
      sourceIds: ['sep-testimony', 'kant-enlightenment'],
    },
    {
      from: 'testimony', to: 'pragmatism', kind: 'context',
      explanation: 'Editorial comparison (not a historical influence claim): Leonard supplies competing accounts of why a report can be accepted, while Legg/Hookway describe correction through inquiry rather than mere tenacity or authority. Read together, they invite attention to how a trusted practice handles mistakes without implying that successful coordination guarantees truth.',
      sourceIds: ['sep-testimony', 'sep-pragmatism'],
    },
    {
      from: 'stoicism', to: 'epicureanism', kind: 'contrasts',
      explanation: 'Editorial comparison (not a historical influence claim): the Stoicism entry makes virtue the sole good sufficient for happiness; Konstan describes Epicurus’s pleasurable freedom from pain and disturbance. Both investigate desire and troubled feeling, but their accounts of what makes life good genuinely differ. Neither is simply a recommendation to feel calm.',
      sourceIds: ['sep-stoicism', 'sep-epicurus'],
    },
    {
      from: 'stoicism', to: 'aristotle', kind: 'contrasts',
      explanation: 'Editorial comparison (not a historical influence claim): Aristotle’s account includes a role for external goods and friendship in flourishing; the Stoic account distinguishes virtue from external things that are indifferent in strict value. Their disagreement tests whether protecting moral agency from fortune requires making happiness independent of material loss.',
      sourceIds: ['sep-stoicism', 'sep-aristotle'],
    },
    {
      from: 'stoicism', to: 'buddhist', kind: 'explores',
      explanation: 'Editorial comparison (not a historical influence claim): Stoic assent and valuation can be placed beside Siderits’s reconstruction of craving and appropriation to examine how distress develops. Their accounts of self, nature, and liberation are different. A useful question about a reaction is not evidence that both traditions teach one universal psychological technique.',
      sourceIds: ['sep-stoicism', 'sep-buddha'],
    },
    {
      from: 'stoicism', to: 'phenomenology', kind: 'contrasts',
      explanation: 'Editorial comparison (not a historical influence claim): Smith’s descriptive account of experience asks how something appears, while Stoic ethics evaluates assent and what is genuinely good. Description can precede evaluation in our writing exercise, but phenomenological bracketing is not Stoic training and does not itself endorse the Stoic theory of value.',
      sourceIds: ['sep-stoicism', 'sep-phenomenology'],
    },
    {
      from: 'epicureanism', to: 'aristotle', kind: 'contrasts',
      explanation: 'Editorial comparison (not a historical influence claim): Konstan’s Epicurus examines pleasure and the limits of desire; Kraut’s Aristotle examines excellent activity, practical judgment, and competing lives. A demanding achievement can look like worthwhile exercise of excellence or unnecessary exposure to disturbance. The sources make that a disagreement to investigate rather than an easy balance.',
      sourceIds: ['sep-epicurus', 'sep-aristotle'],
    },
    {
      from: 'aristotle', to: 'confucian', kind: 'explores',
      explanation: 'Editorial comparison (not a historical influence claim): habituation in Kraut’s Aristotle and ritual cultivation in Csikszentmihalyi’s early Confucian materials both direct attention to formation through practice. Ren, li, the human function argument, and their political settings do different work. “Virtue” can introduce a comparison, not establish an identity between these projects.',
      sourceIds: ['sep-aristotle', 'sep-confucius'],
    },
    {
      from: 'aristotle', to: 'islamic', kind: 'context',
      explanation: 'Editorial comparison (not a historical influence claim): read Kraut on flourishing beside Druart on al-Fārābī’s happiness, logic, and hierarchical city to ask how personal excellence relates to institutions. Druart records a lost ethical commentary and interpretive uncertainty; this edge does not infer a direct transmission of any particular ethical doctrine from resemblance.',
      sourceIds: ['sep-aristotle', 'sep-farabi'],
    },
    {
      from: 'skepticism', to: 'pragmatism', kind: 'contrasts',
      explanation: 'Editorial comparison (not a historical influence claim): Vogt’s ancient skeptics investigate assent and suspension; Legg/Hookway’s pragmatists emphasize real doubt, fallibilism, and inquiry into a problematic situation. Both challenge unexamined confidence, but fallibilist belief is not identical to Pyrrhonian suspension and Dewey’s transformed situation is not the same aim as tranquility.',
      sourceIds: ['sep-skepticism', 'sep-pragmatism'],
    },
    {
      from: 'skepticism', to: 'daoist', kind: 'explores',
      explanation: 'Editorial comparison (not a historical influence claim): Vogt’s account of opposing appearances can be read beside Hansen’s account of multiple learned paths and naming practices. Each can unsettle confidence, but neither author’s subject should be translated into the other’s framework. Daoist disputes about ways of proceeding are not simply Greek arguments about withholding assent.',
      sourceIds: ['sep-skepticism', 'sep-daoism'],
    },
    {
      from: 'skepticism', to: 'nyaya', kind: 'contrasts',
      explanation: 'Editorial comparison (not a historical influence claim): the ancient skepticism entry examines suspension and its practical objections, while the Indian epistemology survey describes Nyāya’s defenses of knowledge sources and ordinary knowing against challenges. The comparison asks what a legitimate doubt must establish; it does not posit a single skeptical opponent shared across these settings.',
      sourceIds: ['sep-skepticism', 'sep-nyaya'],
    },
    {
      from: 'kant', to: 'utilitarianism', kind: 'contrasts',
      explanation: 'Editorial comparison (not a historical influence claim): Johnson/Cureton explain unconditional moral requirements and respect for rational agency; Driver explains classical efforts to promote overall good. The conflict concerns whether beneficial results can justify an otherwise objectionable principle or use of a person. Neither source licenses reducing its position to a slogan or a mechanical calculation.',
      sourceIds: ['sep-kant', 'sep-utilitarianism'],
    },
    {
      from: 'kant', to: 'confucian', kind: 'contrasts',
      explanation: 'Editorial comparison (not a historical influence claim): Kantian universal requirements and early Confucian cultivation through particular roles suggest different starting points for obligation. The sources do not justify calling one purely individual and the other purely collective. Ask instead when a relationship-specific demand can be justified to the person who must meet it.',
      sourceIds: ['sep-kant', 'sep-confucius'],
    },
    {
      from: 'kant', to: 'african-relational', kind: 'explores',
      explanation: 'Editorial comparison (not a historical influence claim): Kantian respect and Gyekye’s account of moral personhood offer a pointed question about ethical appraisal versus basic standing. Gyekye emphasizes character and relational duty; Kant’s humanity formula concerns the standing of rational agency. The pack’s objection to excluding dissenters is an editorial test, not a claim that their vocabularies coincide.',
      sourceIds: ['sep-kant', 'sep-african-ethics'],
    },
    {
      from: 'utilitarianism', to: 'african-relational', kind: 'contrasts',
      explanation: 'Editorial comparison (not a historical influence claim): Driver’s overall good and Gyekye’s common good both look beyond private advantage, but relational responsibilities need not amount to maximizing an aggregate. The comparison asks whether a relationship creates obligations that an impartial total would miss, without labeling Akan thought a form of utilitarianism.',
      sourceIds: ['sep-utilitarianism', 'sep-african-ethics'],
    },
    {
      from: 'pragmatism', to: 'nyaya', kind: 'explores',
      explanation: 'Editorial comparison (not a historical influence claim): Legg/Hookway’s accounts of inquiry and Phillips/Vaidya’s discussion of knowledge, action, and certification allow a comparison of warranted doubt. Nyāya’s pramāṇa framework is not American pragmatism, and practical success is not a shared sufficient definition of truth. The useful question is how a specific challenge changes what must be checked.',
      sourceIds: ['sep-pragmatism', 'sep-nyaya'],
    },
    {
      from: 'existentialism', to: 'confucian', kind: 'contrasts',
      explanation: 'Editorial comparison (not a historical influence claim): Aho’s situated freedom can challenge using a role to evade responsibility, while Csikszentmihalyi’s ritual formation challenges the picture of a self formed outside relationships. Neither eliminates the other question: how are capacities cultivated, and how can someone answer for revising what they inherited?',
      sourceIds: ['sep-existentialism', 'sep-confucius'],
    },
    {
      from: 'existentialism', to: 'african-relational', kind: 'explores',
      explanation: 'Editorial comparison (not a historical influence claim): Aho’s attention to socially mediated possibilities and Gyekye’s relational account both complicate self-sufficiency. Their accounts of personhood and responsibility remain distinct. Read them together to ask whether a community enables a person’s freedom, defines its limits, or does both at once.',
      sourceIds: ['sep-existentialism', 'sep-african-ethics'],
    },
    {
      from: 'phenomenology', to: 'buddhist', kind: 'explores',
      explanation: 'Editorial comparison (not a historical influence claim): Smith’s structures of experience and Siderits’s discussion of appropriation can prompt close attention to how a feeling becomes a claim about oneself. Phenomenological description does not entail Buddhist non-self, and early Buddhist liberation is not exhausted by describing experience. This is a shared editorial question, not a merged method.',
      sourceIds: ['sep-phenomenology', 'sep-buddha'],
    },
    {
      from: 'phenomenology', to: 'daoist', kind: 'explores',
      explanation: 'Editorial comparison (not a historical influence claim): Smith describes embodied, meaningful experience; Hansen emphasizes learned ways of distinguishing and proceeding. The attention essay asks how a ready-made label shapes a situation’s appearance. That application does not identify Daoist paths with phenomenological intentionality or claim that either source establishes the other’s theory.',
      sourceIds: ['sep-phenomenology', 'sep-daoism'],
    },
    {
      from: 'confucian', to: 'african-relational', kind: 'explores',
      explanation: 'Editorial comparison (not a historical influence claim): early Confucian ritual cultivation and Gyekye’s Akan-centered moral personhood both give relationships ethical weight. Their concepts, histories, and institutional settings differ. The comparison examines how care becomes a duty and how dissent can remain possible, not whether Chinese and African cultures share one communal essence.',
      sourceIds: ['sep-confucius', 'sep-african-ethics'],
    },
    {
      from: 'daoist', to: 'buddhist', kind: 'contrasts',
      explanation: 'Editorial comparison (not a historical influence claim): Hansen’s account of paths and naming is placed beside Siderits’s reconstruction of suffering and non-self. Both can challenge fixed self-descriptions in our example, but early Buddhist liberation and the classical Daoist texts have distinct questions and commitments. This edge is not a history of later interactions between Buddhist and Daoist traditions.',
      sourceIds: ['sep-daoism', 'sep-buddha'],
    },
    {
      from: 'islamic', to: 'utilitarianism', kind: 'contrasts',
      explanation: 'Editorial comparison (not a historical influence claim): Druart’s al-Fārābī connects happiness with intellectual and political order; Driver’s classical utilitarians examine overall pleasure and well-being. Their uses of happiness should not be assumed commensurable. Ask who defines a public good and whether hierarchy or aggregation supplies a defensible answer, without assigning either view to a whole religious culture.',
      sourceIds: ['sep-farabi', 'sep-utilitarianism'],
    },
  ],
});
