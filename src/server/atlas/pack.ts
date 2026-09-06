// The Atlas content pack, Edition I — "What endures".
//
// Versioned exactly like the personas: a frozen server constant, validated by
// the shared zod schema at boot (a malformed pack fails fast, never renders).
// Essays are editorial syntheses checked against the listed sources. The pack
// records the sources and retrieval dates, but does not claim automated
// fact-checking or complete claim-to-source coverage.
import { atlasPackSchema, type AtlasPack } from '../../shared/atlas.js';

const EDITION_I: AtlasPack = {
  version: 'atlas-v1.1.0',
  createdAt: '2026-09-06',
  edition: { number: 1, title: 'What endures' },
  provenance:
    'Hand-curated first edition. Essays were checked against the listed sources and editorially reviewed before this revision was frozen. Interpretive passages are synthesis; this pack is not an automated fact-check. Retrieval dates are on every plate.',
  plates: [
    {
      id: 'liternum',
      number: 1,
      kind: 'place',
      title: 'Liternum: the garden of the general',
      standfirst:
        'A retired general’s villa on the Campanian shore, where Seneca went to look at what time does to glory.',
      question: 'What would you keep, knowing the garden outlasts the general?',
      writeFromQuote: 'The garden outlasted the general; the letter outlasted the garden.',
      view: {
        kind: 'streetview',
        // Re-curated by probe: no coverage exists inside the archaeological
        // site, so the vantage stands on the nearest covered road (2023-03
        // imagery, 440 m out) with the heading pointing at the site center.
        lat: 41.046391,
        lng: 13.998804,
        heading: 146,
        pitch: 5,
        fov: 90,
        placeLine: 'Lago Patria, Giugliano in Campania, Italy',
        coordsLine: '41.0464° N, 13.9988° E',
      },
      bodyMd: `You are standing on the Campanian coast, north of Naples, where the land flattens toward a small volcanic lake and the sea is a low line of pines away. Under the modern streets of Lago Patria, the colony of Liternum keeps a low profile: a stretch of road, the podium of a temple, the stone shell of a small amphitheater, and, on the rise beside them, the ruin that gives the place its meaning — a tomb the tradition has always called Scipio's.

Scipio Africanus was the man who broke Hannibal. At Zama in 202 BC he defeated the general who had spent sixteen years making Italy afraid of him, and Rome put his achievement into his name. He was, by common consent of the ancients, the greatest soldier the city had produced. And the rest of his story is why this plate exists. The political fights of the 190s BC turned against him; trials and prosecutions were pressed by his enemies, led by Cato the Elder; and around 187 BC Scipio withdrew from Rome. He crossed to this coast, to an estate at Liternum, and lived there in retirement until his death in 183 BC. Ancient accounts disagree about the exact circumstances of his last days — where precisely he died, whether the tomb here is his or a memorial — and that disagreement is itself the point. What is not disputed is the shape of the arc: the man who saved Rome ended his life a long way from Rome, by choice and by necessity, among gardens and lake water.

Two hundred and fifty years later, Seneca came to see it.

The letter he wrote to Lucilius about the visit is the eighty-sixth of the collection — the same Lucilius this application is named for, the friend and provincial governor for whom the whole corpus of moral letters was written. In it, Seneca describes Scipio's estate: the bath chamber with its walls still darkened by the smoke and heat of old fires, the grounds where the great man had lived his last years out of sight of the city that owed him everything. Seneca's reflection is not a tourist's sigh. He contrasts the plain retreat with the luxuries of his own age and asks what a life needs. If the conqueror of Hannibal could live simply after public glory, then the wise man should measure his life by what he can carry inward, not by what he can parade.

There is a second lesson built quietly into the letter, and it is about writing. Scipio's triumph is gone; his garden is a ruin you can visit on a weekday morning; his name survives chiefly because a later man used it as material for a moral essay. The letter did the preserving. The physical site keeps only the outline of the life; the written reflection keeps its meaning. That inversion — the monument outlasted by the meditation — is the oldest proof we have of this application's whole wager: that words, written honestly and read slowly, are how experience endures.

So this plate is not really about Scipio, and it is not really about ruins. It is about the practice of looking at what time has done and letting it edit you. Seneca walked here to let the general's retreat recalibrate his own ambitions, and then he sat down and described the walk so that a friend could take it with him. You are taking it two millennia later, which neither of them could have predicted and both would have understood.

Stand there a moment. The lake is quiet, the amphitheater is grass, the tomb is a shape. Ask the garden what it kept.`,
      marginNotes: [
        { fact: 'Scipio Africanus defeats Hannibal at Zama and adds “Africanus” to his name — the achievement that made his later retreat so bitter.', date: '202 BC' },
        { fact: 'Out of favor and under prosecution by his enemies, Scipio withdraws to his estate at Liternum; ancient sources disagree on where exactly he died.', date: 'c. 187–183 BC' },
        { fact: 'Seneca visits the estate and writes Letter 86 to Lucilius, contrasting Scipio’s plain bath with his own age’s luxury.', date: 'c. AD 50s–60s' },
      ],
      sources: [
        {
          title: 'Parco Archeologico di Liternum',
          publisher: 'Regione Campania',
          url: 'https://cultura.regione.campania.it/en/web/archeologia/partner?id=902157',
          retrievedAt: '2026-09-06',
        },
        {
          title: 'Seneca, Moral Letters to Lucilius (Letter 86; Gummere translation)',
          publisher: 'Wikisource',
          url: 'https://en.wikisource.org/wiki/Moral_letters_to_Lucilius/Letter_86',
          retrievedAt: '2026-09-06',
        },
      ],
    },
    {
      id: 'antikythera-mechanism',
      number: 2,
      kind: 'work',
      title: 'The machine that kept the sky',
      standfirst:
        'A bronze astronomy computer from the ancient Aegean, lost at sea for two thousand years, still calculating when it was raised.',
      question: 'What else have we lost that we cannot imagine?',
      writeFromQuote: 'Precision outlives the civilization that wanted it.',
      view: {
        kind: 'streetview',
        lat: 37.9841,
        lng: 23.7282,
        heading: 200,
        pitch: 5,
        fov: 90,
        placeLine: 'National Archaeological Museum, Athens',
        coordsLine: '37.9841° N, 23.7282° E',
      },
      bodyMd: `In a gallery of the National Archaeological Museum in Athens, among the masks and the marbles, there is a case holding what look like corroded lumps of green bronze. The largest is about the size of a shoebox lid, and its biggest gear is roughly thirteen centimeters across. It is, by the consensus of a century of research, a geared astronomical calculator — built in the second or early first century BC, capable of predicting eclipses and tracking the heavens — and nothing else like it survives from the ancient world for well over a thousand years afterward.

The story of its finding is a story about attention. In 1900, sponge divers from Symi were working the waters between Kythera and Crete, off the island of Antikythera, and found a Roman-era shipwreck steep on a slope at depths no diver of the time should have survived. They brought up statues, glassware, coins — and a broken calcified lump that nobody knew what to do with. Within a year the lump was in the museum in Athens and beginning to fall apart, revealing gear wheels inside. The statues got the headlines; the lumps got dismissed by more than one scholar as too complex to be ancient. It took decades of stubborn looking — and, from the 1970s onward, X-ray and tomographic imaging — to reveal what was inside: dozens of interlocking gears, dials for the Sun and Moon, a train that reproduces the Moon's uneven speed across the sky, a dial for eclipses on the Saros cycle, a calendar on the nineteen-year Metonic period, even, it appears, a dial for the four-year cycle of the Olympic games.

Sit with what that means. Somebody in the ancient Mediterranean designed and built a mechanical model of the sky — not a philosophy of the sky, a mechanism for it — and the know-how behind it was so rare that when the objects like it disappeared, the civilization that came next spent centuries assuming no such thing had ever existed. Gears of that sophistication reappear in Europe only in the late Middle Ages. The machine did not fail; the memory of it failed. What survived was a fragment of the thing itself plus, slowly, painstakingly, the science of reading it back.

That is why this plate sits in an atlas of reflection. The Antikythera mechanism is the strongest material argument we have for epistemic humility across time. Every civilization, including this one, is surrounded by know-how it does not realize is fragile, carried by people it does not think to record, kept alive by chains of practice that a single lost generation can snap. The divers who hauled it up did not know what they had; the scholars who dismissed it did not know what they were looking at; it took better instruments and more patient eyes to let the object testify. Most of what matters about your own life is probably like that too — held in fragments, legible only later, waiting on better instruments or a more patient reader.

The mechanism is also a small monument to its makers' realism. The gears do not pretend the sky is simpler than it is: the strange looping motion of the Moon is modeled with a pin-and-slot arrangement, an elegant mechanical solution to an astronomical embarrassment. Whoever built it chose accuracy over convenience. That choice — precision as a form of respect for the way things actually are — is a virtue the machine has outlived its builders to teach.

You are standing outside the museum that keeps it. Inside, the fragments lie in ordered pieces, labeled and lit. Two thousand years is a long time to hold a thought. This one held.`,
      marginNotes: [
        { fact: 'Sponge divers find a Roman-era shipwreck off Antikythera and bring up statues — and a corroded bronze lump that reaches the Athens museum the following year.', date: '1900–1901' },
        { fact: 'The accepted window for the mechanism’s construction; it models the Moon and Sun, predicts eclipses on the Saros cycle, and tracks the 19-year Metonic calendar.', date: '2nd–early 1st century BC' },
        { fact: 'X-ray and CT imaging reveals the hidden gear trains and hidden dials, including (per 2000s research) a cycle for the Olympic games.', date: '1971 onward' },
      ],
      sources: [
        {
          title: 'The Mysteries of the Mechanism of Antikythera',
          publisher: 'National Archaeological Museum, Athens',
          url: 'https://antikythera-mechanism.namuseum.gr/en/',
          retrievedAt: '2026-09-06',
        },
      ],
    },
    {
      id: 'hagia-sophia',
      number: 3,
      kind: 'place',
      title: 'One building, two empires',
      standfirst:
        'A cathedral turned mosque turned museum turned mosque — fifteen centuries of change held inside one dome.',
      question: 'What has changed hands around you without changing its shape?',
      writeFromQuote: 'The dome held by learning what fell; so do we.',
      view: {
        kind: 'streetview',
        lat: 41.0055,
        lng: 28.9766,
        heading: 62,
        pitch: 8,
        fov: 90,
        placeLine: 'Sultanahmet Square, Istanbul',
        coordsLine: '41.0083° N, 28.9800° E',
      },
      bodyMd: `From the corner of Sultanahmet Square where you now stand, the building across the garden does something few structures can: it looks inevitable. The dome seems less built than settled, the way a mountain is settled. Nothing about it suggests that it has fallen down once, changed religion twice, changed job descriptions four times, and spent fifteen hundred years being argued over by emperors, sultans, historians, and tourists.

Begin in 532. The previous church on this spot had burned in the Nika riots, the worst civil violence of Justinian's reign, and the emperor answered a burned capital by commissioning a church nobody had the knowledge to build. Two theoreticians took the contract: Anthemius of Tralles, a geometer and physicist, and Isidore of Miletus, an engineer and architect. In under six years they raised the largest enclosed space in the world — a vaulted canopy carried on piers and on curves of masonry that had few precedents and no safety net. The church was dedicated on 27 December 537, and a line the chroniclers would later put in Justinian's mouth — that he had outdone Solomon — is legend, but the pride it records was real, and in fairness, so was the achievement. For the better part of a thousand years, no church on earth was larger.

Then the building taught its builders something. The first dome fell in 558, shaken by an earthquake the winter before, and the repair fell to Isidore the Younger, the original architect's nephew or namesake. He rebuilt the vault higher, on a stiffer geometry, and it is his dome — ribbed, windowed at the base so the crown of light seems to hover — that you are looking at now. The most beautiful thing about Hagia Sophia is literally a revision: the second draft, made by a man correcting his teacher with the evidence of a collapse.

The rest of the building's biography is the history of a city told without moving. In 1453 the Ottoman conquest turned the cathedral into a mosque; the change was political and religious, but architecturally it was mostly an argument about furniture and paint — minarets added outside, mosaics plastered over inside, the mihrab angled slightly off the dome's axis because prayer direction and building axis could not agree. In 1935 the new Turkish republic turned it into a museum, and conservators began uncovering the mosaics the plaster had kept dry for centuries: seraphs in the pendentives, emperors and empresses presenting gifts, Christ enthroned — a whole medieval art gallery preserved by being hidden. In 2020 it returned to use as a mosque, and the arguments about it began again, which is arguably the most traditional thing that could happen to it.

What does a reflective person take from a building like this? First, that endurance is rarely a matter of staying the same. Hagia Sophia has survived by being useful to whoever held it, absorbing each change of use into its structure without losing the geometry that makes it sublime. Second, that the pieces of a life can be plastered over rather than destroyed — the seraphs were there the whole time, waiting on better attention. Third, that revision is not failure. The dome you find beautiful is already the second dome.

You are looking at a building that has been wrong about its own future for fifteen centuries and has never once been the worse for it. It is one of the few things on earth that has practiced change longer than any of us have practiced staying still.`,
      marginNotes: [
        { fact: 'The church is dedicated under Justinian I, built by Anthemius of Tralles and Isidore of Miletus after the Nika riots burned its predecessor.', date: '27 December 537' },
        { fact: 'An earthquake the previous winter drops the first dome; Isidore the Younger rebuilds it higher and stiffer — the dome visible today.', date: '7 May 558' },
        { fact: 'Conquest turns it into a mosque; it becomes a museum in 1935 (mosaics uncovered); it returns to use as a mosque in 2020.', date: '1453 · 1935 · 2020' },
      ],
      sources: [
        {
          title: 'History of Hagia Sophia Museums',
          publisher: 'Hagia Sophia Museums',
          url: 'https://hagiasophiamuseums.org/en/history',
          retrievedAt: '2026-09-06',
        },
        {
          title: 'Historic Areas of Istanbul (World Heritage List, ref. 356)',
          publisher: 'UNESCO World Heritage Centre',
          url: 'https://whc.unesco.org/en/list/356/',
          retrievedAt: '2026-09-06',
        },
      ],
    },
    {
      id: 'the-lyceum',
      number: 4,
      kind: 'idea',
      title: 'Thinking at walking pace',
      standfirst:
        'A grove and gymnasium east of Athens, where a school took its name from the covered walkways its students thought in.',
      question: 'Where does your best thinking happen — and at what pace?',
      writeFromQuote: 'The school took its name from the walking.',
      view: {
        kind: 'streetview',
        lat: 37.9741,
        lng: 23.7435,
        heading: 180,
        pitch: 5,
        fov: 90,
        placeLine: 'Rigillis, central Athens',
        coordsLine: '37.9741° N, 23.7435° E',
      },
      bodyMd: `The idea on this plate is easy to state and strange to believe: some of the most consequential thinking in European history happened at about three miles an hour, in a grove, on foot. In 335 BC, Aristotle — newly back in Athens after years in Macedonia tutoring the future Alexander — took over a gymnasium and sanctuary of Apollo Lyceus just outside the city walls to the east, and the school he founded there became the Lyceum. Its members became the Peripatetics, and ancient sources debate whether the name comes from the peripatos, the covered walkway of the grounds, or from the habit of walking while discussing. Either way the image survives: philosophy with a pace, conducted at the speed of footsteps.

That pace was not an accident; it was the method. Walking is thinking with the body's help — it occupies the restless parts of the mind just enough, keeps the blood moving, supplies a rhythm that conversation can settle into. Anyone who has ever solved a problem on a long walk knows the mechanism. The Lyceum's genius was to institutionalize it: lectures, research, and debate organized around movement through a garden. Aristotle's own surviving lecture-notes — we read his treatises today as working documents, the scaffolding of courses — show a mind that worked by walking through a subject: define, distinguish, collect what people say, test it, walk around the question until the sides of it are visible.

The school outlived its founder, but its afterlife is mostly a story about loss and wandering, which is why it belongs in an edition about what endures. Theophrastus took over and made it a research institute on a scale Aristotle never managed. Then the library — the school's most valuable possession — began its long journey: ancient reports say it was bequeathed to Neleus and carried to Scepsis, while the later history of the collection remains disputed. The precinct itself was damaged in Sulla's siege of Athens in 86 BC and sank under later centuries of the growing city. For most of the last two thousand years, the Lyceum was a name with no address — the idea survived while the place was lost, an inversion of the usual ruin.

Then, in 1996, digging for a Museum of Modern Art on Vasilissis Sofias Avenue struck the remains: gymnasium walls, a palaestra, bathing rooms, the footprint of the precinct at the junction the ancients described. The find stopped the construction and started an argument between the city's future and its past; the archaeology won. Since 2009 the site has been open to the public — a few low courses of stone in a shallow bowl of green between apartment blocks and traffic, unimpressive to the eye and overwhelming to the thought. Every institution you have ever trusted — every university, every lab, every journal, every school that believes knowledge is a communal practice rather than a private possession — is a descendant of what happened here at walking pace.

You are standing at the corner where it resurfaced. The traffic on Vasilissis Sofias is the loudest thing for a mile, which is a reminder worth keeping: the Lyceum's true monument is not the stones. It is the assumption, now so ordinary it is invisible, that people can get together and reason their way to better ideas — slowly, out loud, together, on foot.`,
      marginNotes: [
        { fact: 'Aristotle, returned from Macedonia, founds his school at the gymnasium of Apollo Lyceus east of Athens; the “Peripatetic” name ties it to the covered walkway or to walking debate.', date: '335 BC' },
        { fact: 'After Theophrastus, ancient reports place the school’s library with Neleus at Scepsis; the collection’s later path is disputed, and the precinct is damaged in Sulla’s siege.', date: '86 BC' },
        { fact: 'The lost site resurfaces during construction work on Vasilissis Sofias Avenue and opens to the public as an archaeological park.', date: '1996 · 2009' },
      ],
      sources: [
        {
          title: 'Aristotle’s Lyceum',
          publisher: 'City of Athens',
          url: 'https://www.thisisathens.org/antiquities/aristotles-lyceum',
          retrievedAt: '2026-09-06',
        },
      ],
    },
    {
      id: 'hypatia',
      number: 5,
      kind: 'life',
      title: 'Hypatia: what survives of a mind',
      standfirst:
        'Alexandria’s astronomer and philosopher, murdered in 415, known to us almost entirely through other people’s words.',
      question: 'Whose words are you keeping, that your own may not survive?',
      writeFromQuote: 'Her mind survives as a correspondence.',
      view: {
        kind: 'streetview',
        lat: 31.2089,
        lng: 29.9093,
        heading: 95,
        pitch: 5,
        fov: 90,
        placeLine: 'Eastern Harbor, Alexandria, Egypt',
        coordsLine: '31.2089° N, 29.9093° E',
      },
      bodyMd: `The water in front of you is the Eastern Harbor of Alexandria, and it is hiding most of what this plate is about. Under it lie the palaces of the Ptolemies and the lost precincts of the ancient city; along it runs a modern corniche built over classical ground. Somewhere in these streets, at the start of the fifth century AD, Hypatia taught mathematics, astronomy, and philosophy to students who crossed the Mediterranean to hear her — and in March of 415, on this city's streets, she was murdered by a mob. She was born here around the middle of the fourth century and never left it, which makes her one of the few people in this atlas whose whole life is within sight of this water.

What did she actually do? The honest answer is: less than the legends say, and still enough to matter. She was the daughter of Theon, a mathematician of the city's Museum tradition, and she became the leading teacher of the Neoplatonic school in Alexandria — a public intellectual in a city built on the idea that knowledge was a public thing. Her students were the sons of the provincial elite; her letters and lectures were famous; Synesius of Cyrene, who became a bishop, wrote to her for years afterward with the warmth of a lifelong student, and it is his correspondence that gives us most of what we know about her as a person. Scholars attribute to her hand parts of the surviving commentaries on Diophantus's arithmetic and on Ptolemy's astronomy — the technical editing that kept difficult books teachable. No work under her own name survives. We have her influence the way you have a star's light: by what it illuminated on the way here.

The manner of her death has always threatened to swallow her life. In 415 Alexandria was in a slow-running feud between Orestes, the Roman prefect, and Cyril, the city's bishop, with Hypatia — a pagan philosopher, respected by both sides, close to the prefect — caught in the middle. A mob seized her, stripped her, and killed her with tiles or shards in a church precinct; the contemporary account is brutal in a matter-of-fact way that still lands hard. In the centuries since, everyone has wanted her: Enlightenment polemicists made her the martyr of science versus faith; nineteenth-century novels and twentieth-century films made her the last librarian of a mythic Alexandria; modern historians have patiently taken all of it apart. What is left after the myth-making is smaller and better: a real teacher, working in a violent and factional city, whose competence and independence made her a target when politics turned ugly.

That is a life worth standing still for, precisely because it refuses the easy versions. Her mind survives as a correspondence — the words of students, the edited textbooks, the questions people kept asking her. Very little of it is her own hand, and yet the hand is everywhere. If you have ever wondered what will be left of you after time and translation and other people's summaries, Hypatia is the honest case study: what survives of a mind is not the monuments it built but the words it moved through, and the people who kept writing back.

The harbor is still here, holding what it holds. The letters are still here too. For a reflective person, that comparison is the whole plate.`,
      marginNotes: [
        { fact: 'Hypatia of Alexandria — mathematician, astronomer, and Neoplatonic philosopher — is killed by a mob amid the feud between the prefect Orestes and Bishop Cyril.', date: 'March 415' },
        { fact: 'No work under her own name survives; scholars attribute parts of the commentaries on Diophantus and Ptolemy to her hand.', date: 'surviving record' },
        { fact: 'The letters of Synesius of Cyrene, her student for life, are the main window into her mind and teaching.', date: 'c. 393–413' },
      ],
      sources: [
        {
          title: 'The Letters of Synesius of Cyrene',
          publisher: 'Wikisource (Fitzgerald translation)',
          url: 'https://en.wikisource.org/wiki/The_Letters_of_Synesius_of_Cyrene',
          retrievedAt: '2026-09-06',
        },
        {
          title: 'Hypatia (1911 Encyclopaedia Britannica)',
          publisher: 'Wikisource',
          url: 'https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Hypatia',
          retrievedAt: '2026-09-06',
        },
      ],
    },
  ],
};

// Fails fast at import: a malformed pack must never reach the client.
export const ATLAS_PACK: AtlasPack = atlasPackSchema.parse(EDITION_I);

export const ATLAS_PACK_INDEX = {
  version: ATLAS_PACK.version,
  edition: ATLAS_PACK.edition.title,
  editionNumber: ATLAS_PACK.edition.number,
  createdAt: ATLAS_PACK.createdAt,
  plateCount: ATLAS_PACK.plates.length,
  sourceCount: ATLAS_PACK.plates.reduce((sum, p) => sum + p.sources.length, 0),
  provenance: ATLAS_PACK.provenance,
};
