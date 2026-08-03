export type PublicSeedCard = {
  front: string;
  back: string;
};

export type PublicSeedDeck = {
  slug: string;
  name: string;
  description: string;
  cards: PublicSeedCard[];
};

export const PUBLIC_SEED_DECKS: PublicSeedDeck[] = [
  {
    slug: "intro-psych-foundations",
    name: "Intro Psych Foundations",
    description: "Core terms and concepts from an introductory psychology survey course.",
    cards: [
      { front: "What is psychology?", back: "The scientific study of behavior and mental processes." },
      { front: "What is an independent variable?", back: "The factor a researcher manipulates to test its effect on an outcome." },
      { front: "What is a dependent variable?", back: "The measured outcome that may change in response to the independent variable." },
      { front: "What does correlation measure?", back: "The strength and direction of a relationship between two variables, not causation." },
      { front: "What is classical conditioning?", back: "Learning in which a neutral stimulus becomes associated with a meaningful stimulus and comes to elicit a similar response." },
      { front: "What is operant conditioning?", back: "Learning in which behavior is strengthened or weakened by its consequences, such as reinforcement or punishment." },
      { front: "What is working memory?", back: "A limited-capacity system that temporarily holds and manipulates information for ongoing tasks." },
      { front: "What is confirmation bias?", back: "The tendency to seek, notice, and remember information that supports existing beliefs." },
      { front: "What is the fundamental attribution error?", back: "The tendency to overemphasize personality traits and underemphasize situational factors when explaining others' behavior." },
      { front: "What is a neurotransmitter?", back: "A chemical messenger that transmits signals across a synapse from one neuron to another." }
    ]
  },
  {
    slug: "calc-1-derivatives",
    name: "Calc 1 Derivatives",
    description: "Derivative rules and interpretations for first-semester calculus.",
    cards: [
      { front: "What does the derivative f'(x) represent geometrically?", back: "The slope of the tangent line to y = f(x) at x." },
      { front: "What is the derivative of a constant?", back: "Zero." },
      { front: "What is the power rule?", back: "If f(x) = x^n, then f'(x) = n x^(n-1)." },
      { front: "What is the product rule?", back: "If y = uv, then y' = u'v + uv'." },
      { front: "What is the quotient rule?", back: "If y = u/v, then y' = (u'v - uv') / v^2." },
      { front: "What is the chain rule?", back: "If y = f(g(x)), then y' = f'(g(x)) * g'(x)." },
      { front: "What is the derivative of sin(x)?", back: "cos(x)." },
      { front: "What is the derivative of e^x?", back: "e^x." },
      { front: "What does f'(a) = 0 often indicate?", back: "A critical point where the graph may have a local max, local min, or horizontal inflection." },
      { front: "What is instantaneous rate of change?", back: "The derivative of a quantity with respect to time (or another independent variable) at a specific point." }
    ]
  },
  {
    slug: "bio-101-cell-basics",
    name: "Bio 101 Cell Basics",
    description: "Cell structure and function essentials for introductory biology.",
    cards: [
      { front: "What is the cell theory?", back: "All living things are made of cells, cells are the basic unit of life, and new cells come from existing cells." },
      { front: "What is the main function of the nucleus?", back: "It stores genetic material and coordinates cell activities such as growth and reproduction." },
      { front: "What do mitochondria do?", back: "They generate most of the cell's ATP through cellular respiration." },
      { front: "What is the difference between prokaryotic and eukaryotic cells?", back: "Prokaryotes lack a membrane-bound nucleus; eukaryotes have a nucleus and other membrane-bound organelles." },
      { front: "What is the role of ribosomes?", back: "They synthesize proteins." },
      { front: "What does the cell membrane control?", back: "What enters and leaves the cell through a selectively permeable phospholipid bilayer." },
      { front: "What is diffusion?", back: "The net movement of molecules from higher to lower concentration." },
      { front: "What is osmosis?", back: "The diffusion of water across a selectively permeable membrane." },
      { front: "What is photosynthesis in one sentence?", back: "Plants and other organisms convert light energy into chemical energy stored in sugars." },
      { front: "What is DNA?", back: "A double-stranded nucleic acid that carries the genetic instructions for an organism." }
    ]
  },
  {
    slug: "cs-101-programming-fundamentals",
    name: "CS 101 Programming Fundamentals",
    description: "Starter concepts for a first programming course, language-agnostic where possible.",
    cards: [
      { front: "What is a variable?", back: "A named storage location that holds a value which can change during program execution." },
      { front: "What is an algorithm?", back: "A clear, finite sequence of steps for solving a problem or performing a task." },
      { front: "What does a loop do?", back: "It repeats a block of code while a condition remains true or for a set number of iterations." },
      { front: "What is a conditional statement?", back: "Code that runs different branches based on whether a condition evaluates to true or false." },
      { front: "What is a function (or method)?", back: "A reusable block of code that performs a task and can take inputs and return an output." },
      { front: "What is an array or list?", back: "An ordered collection of values accessed by index or position." },
      { front: "What is a bug?", back: "An error in a program that causes incorrect or unexpected behavior." },
      { front: "What is debugging?", back: "The process of finding and fixing bugs in code." },
      { front: "What is time complexity at a high level?", back: "A way to describe how an algorithm's running time grows as input size grows." },
      { front: "What does it mean for code to be readable?", back: "Another person (or your future self) can understand the intent through clear names, structure, and comments where needed." }
    ]
  },
  {
    slug: "chem-101-atoms-and-moles",
    name: "Chem 101 Atoms and Moles",
    description: "Atomic structure and mole calculations for general chemistry.",
    cards: [
      { front: "What is an atom?", back: "The smallest unit of an element that retains the chemical identity of that element." },
      { front: "What particles make up an atom?", back: "Protons and neutrons in the nucleus, with electrons outside the nucleus." },
      { front: "What is the atomic number?", back: "The number of protons in an atom's nucleus; it identifies the element." },
      { front: "What is an isotope?", back: "Atoms of the same element with different numbers of neutrons." },
      { front: "What is a mole?", back: "An amount of substance containing Avogadro's number of particles, about 6.022 x 10^23." },
      { front: "What is molar mass?", back: "The mass of one mole of a substance, usually in grams per mole." },
      { front: "How do you convert grams to moles?", back: "Divide the mass in grams by the substance's molar mass." },
      { front: "What is a chemical formula?", back: "A notation that shows the types and relative numbers of atoms in a compound." },
      { front: "What is the law of conservation of mass?", back: "Matter is neither created nor destroyed in a chemical reaction; atoms are rearranged." },
      { front: "What is a balanced chemical equation?", back: "An equation with the same number of each type of atom on both reactant and product sides." }
    ]
  },
  {
    slug: "us-history-founding-era",
    name: "US History Founding Era",
    description: "Key ideas and events from the American founding period.",
    cards: [
      { front: "What year was the Declaration of Independence adopted?", back: "1776." },
      { front: "What was the main purpose of the Declaration of Independence?", back: "To explain why the colonies were separating from Britain and to assert natural rights and consent of the governed." },
      { front: "What were the Articles of Confederation?", back: "The first U.S. national government framework, which created a weak central government." },
      { front: "Why did many leaders want to replace the Articles of Confederation?", back: "The national government lacked sufficient power to tax, regulate commerce, and maintain stability." },
      { front: "What year was the U.S. Constitution written?", back: "1787." },
      { front: "What is federalism?", back: "A system that divides power between a national government and state governments." },
      { front: "What are checks and balances?", back: "Constitutional arrangements that let each branch of government limit the powers of the others." },
      { front: "What was the Bill of Rights?", back: "The first ten amendments to the Constitution, protecting individual liberties." },
      { front: "What was the Great Compromise?", back: "The agreement creating a bicameral Congress with proportional representation in the House and equal representation in the Senate." },
      { front: "Who is often called the 'Father of the Constitution'?", back: "James Madison." }
    ]
  },
  {
    slug: "macroeconomics-core",
    name: "Macroeconomics Core",
    description: "Foundational macro concepts for an intro economics course.",
    cards: [
      { front: "What does GDP measure?", back: "The market value of all final goods and services produced within a country in a given period." },
      { front: "What is inflation?", back: "A sustained increase in the general price level, which reduces purchasing power." },
      { front: "What is unemployment rate?", back: "The percentage of the labor force that is jobless and actively seeking work." },
      { front: "What is fiscal policy?", back: "Government use of spending and taxation to influence the economy." },
      { front: "What is monetary policy?", back: "Central bank actions that influence money supply and interest rates." },
      { front: "What is aggregate demand?", back: "The total demand for final goods and services in an economy at a given price level." },
      { front: "What is a recession?", back: "A significant decline in economic activity lasting more than a few months." },
      { front: "What is the difference between nominal and real GDP?", back: "Nominal GDP is measured in current prices; real GDP is adjusted for inflation." },
      { front: "What is opportunity cost?", back: "The value of the next-best alternative forgone when a choice is made." },
      { front: "What does 'ceteris paribus' mean?", back: "Other things equal; holding other relevant factors constant." }
    ]
  },
  {
    slug: "spanish-1-core-verbs",
    name: "Spanish 1 Core Verbs",
    description: "High-frequency Spanish verbs and present-tense basics for beginners.",
    cards: [
      { front: "What does 'ser' mean, and when is it commonly used?", back: "To be; used for identity, origin, time, and lasting characteristics." },
      { front: "What does 'estar' mean, and when is it commonly used?", back: "To be; used for location, temporary states, and progressive constructions." },
      { front: "Conjugate 'hablar' in the yo form (present).", back: "hablo" },
      { front: "Conjugate 'comer' in the ella form (present).", back: "come" },
      { front: "Conjugate 'vivir' in the nosotros form (present).", back: "vivimos" },
      { front: "What does 'tener' mean?", back: "To have." },
      { front: "What does 'ir' mean?", back: "To go." },
      { front: "How do you say 'I want' in Spanish?", back: "quiero" },
      { front: "How do you say 'I need' in Spanish?", back: "necesito" },
      { front: "What is the difference between 'saber' and 'conocer'?", back: "'Saber' is to know facts or how to do something; 'conocer' is to be familiar with people or places." }
    ]
  }
];
