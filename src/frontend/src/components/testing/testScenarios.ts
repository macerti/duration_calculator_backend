export interface TestScenario {
  id: string;
  category: TestCategory;
  categoryLabel: string;
  title: string;
  instructions: string[];
  expected: string;
  verificationQuestion: string;
  suggestedRoute?: string;
  autoCheckType?: "health_check" | "responsive_check";
}

export type TestCategory =
  | "HOME"
  | "CLIENTS"
  | "CASES"
  | "SITE"
  | "NAE"
  | "FACTORS"
  | "SYNTHESE"
  | "REPORT"
  | "NAV"
  | "RESPONSIVE"
  | "SAVE"
  | "SECURITY";

export interface CategoryInfo {
  id: TestCategory;
  label: string;
  icon: string;
}

export const TEST_CATEGORIES: CategoryInfo[] = [
  { id: "HOME", label: "Accueil & Statut", icon: "🏠" },
  { id: "CLIENTS", label: "Clients (CRUD)", icon: "👥" },
  { id: "CASES", label: "Calculs & Liste", icon: "📋" },
  { id: "SITE", label: "Étape 1: Sites & NACE", icon: "🏢" },
  { id: "NAE", label: "Étape 2: Effectifs", icon: "🔢" },
  { id: "FACTORS", label: "Étape 3: Facteurs", icon: "⚖️" },
  { id: "SYNTHESE", label: "Étape 4: Synthèse", icon: "📊" },
  { id: "REPORT", label: "Rapport Traçabilité", icon: "📄" },
  { id: "NAV", label: "Navigation & Pile", icon: "🧭" },
  { id: "RESPONSIVE", label: "Affichage & Mobile", icon: "📱" },
  { id: "SAVE", label: "Persistance & Retry", icon: "💾" },
  { id: "SECURITY", label: "Sécurité & URLs", icon: "🔒" },
];

export const TEST_SCENARIOS: TestScenario[] = [
  // --- 1. Connectivity & Home ---
  {
    id: "HOME-01",
    category: "HOME",
    categoryLabel: "Accueil & Statut",
    title: "Indicateur de connexion au démarrage",
    instructions: [
      "Ouvrir l'application ou rafraîchir la page d'accueil.",
      "Observer le voyant de statut en haut de l'écran.",
    ],
    expected: "Un voyant discret (pastille + texte 'Connecté') apparaît en moins de 3 secondes.",
    verificationQuestion: "Le voyant indique-t-il 'Connecté' avec une pastille verte ?",
    suggestedRoute: "Home",
    autoCheckType: "health_check",
  },
  {
    id: "HOME-02",
    category: "HOME",
    categoryLabel: "Accueil & Statut",
    title: "Rafraîchissement manuel du statut",
    instructions: [
      "Sur la page d'accueil, cliquer ou taper directement sur la pastille de statut.",
    ],
    expected: "Le statut se réactualise immédiatement avec une brève animation de vérification.",
    verificationQuestion: "Le clic sur la pastille relance-t-il la vérification de l'API ?",
    suggestedRoute: "Home",
  },
  {
    id: "HOME-03",
    category: "HOME",
    categoryLabel: "Accueil & Statut",
    title: "Bouton d'action principal unique",
    instructions: [
      "Vérifier les boutons d'action sur l'écran d'accueil.",
    ],
    expected: "Un bouton unique et épuré 'Mes clients' est visible, sans encombrement inutile.",
    verificationQuestion: "Le bouton 'Mes clients' est-il bien l'unique bouton d'action principal ?",
    suggestedRoute: "Home",
  },

  // --- 2. Client management ---
  {
    id: "CLI-01",
    category: "CLIENTS",
    categoryLabel: "Clients (CRUD)",
    title: "Affichage de la liste des clients",
    instructions: [
      "Cliquer sur 'Mes clients' depuis l'accueil.",
      "Si aucun client n'existe, observer le message d'état vide.",
    ],
    expected: "La liste affiche les clients enregistrés ou un texte d'aide convivial invitant à créer un client.",
    verificationQuestion: "La liste des clients s'affiche-t-elle correctement ?",
    suggestedRoute: "ClientsList",
  },
  {
    id: "CLI-02",
    category: "CLIENTS",
    categoryLabel: "Clients (CRUD)",
    title: "Validation champ vide avec vibration (Shake)",
    instructions: [
      "Cliquer sur '+ Nouveau client'.",
      "Laisser le champ du nom complètement vide.",
      "Cliquer sur le bouton 'Créer'.",
    ],
    expected: "Le champ vibre/secoue visuellement et un libellé rouge 'Le nom du client est obligatoire' apparaît. Aucun client n'est créé.",
    verificationQuestion: "Le champ a-t-il secoué avec un message d'erreur rouge sans créer de client ?",
    suggestedRoute: "ClientsList",
  },
  {
    id: "CLI-03",
    category: "CLIENTS",
    categoryLabel: "Clients (CRUD)",
    title: "Création réussie d'un client",
    instructions: [
      "Saisir un nom de client test (ex: 'Société Alpha Test').",
      "Cliquer sur 'Créer'.",
    ],
    expected: "Redirection immédiate vers la fiche détaillée du client créé.",
    verificationQuestion: "Le client est-il créé et arrivez-vous sur sa page de détail ?",
    suggestedRoute: "ClientsList",
  },
  {
    id: "CLI-04",
    category: "CLIENTS",
    categoryLabel: "Clients (CRUD)",
    title: "Renommage d'un client",
    instructions: [
      "Sur la page de détail d'un client, cliquer sur l'icône crayon à côté du nom.",
      "Modifier le nom (ex: ajouter ' - Modifié') et valider.",
      "Naviguer vers l'accueil puis revenir.",
    ],
    expected: "Le nouveau nom est mis à jour immédiatement et persiste après retour.",
    verificationQuestion: "Le nom modifié s'affiche-t-il et est-il bien sauvegardé ?",
  },
  {
    id: "CLI-05",
    category: "CLIENTS",
    categoryLabel: "Clients (CRUD)",
    title: "Suppression optimiste avec toast Annuler",
    instructions: [
      "Sur la liste des clients, cliquer sur l'icône corbeille d'un client test.",
    ],
    expected: "Le client disparaît immédiatement sans boîte de dialogue bloquante. Un toast apparaît en bas avec un bouton 'Annuler' et une barre de progression de 30 secondes.",
    verificationQuestion: "La suppression est-elle instantanée avec le toast d'annulation en bas ?",
    suggestedRoute: "ClientsList",
  },
  {
    id: "CLI-06",
    category: "CLIENTS",
    categoryLabel: "Clients (CRUD)",
    title: "Annulation de suppression (Undo)",
    instructions: [
      "Supprimer un client et cliquer sur 'Annuler' dans le toast avant que la barre ne se vide.",
    ],
    expected: "Le client réapparaît instantanément dans la liste à sa position d'origine.",
    verificationQuestion: "Le clic sur 'Annuler' a-t-il restauré le client dans la liste ?",
    suggestedRoute: "ClientsList",
  },

  // --- 3. Calculations list ---
  {
    id: "CASE-01",
    category: "CASES",
    categoryLabel: "Calculs & Liste",
    title: "Lancement d'un nouveau calcul",
    instructions: [
      "Sur la page d'un client, cliquer sur '+ Nouveau calcul'.",
    ],
    expected: "Le wizard de calcul s'ouvre à l'Étape 1 (Sites & Secteurs).",
    verificationQuestion: "Le wizard s'est-il ouvert directement à l'étape 1 ?",
  },
  {
    id: "CASE-02",
    category: "CASES",
    categoryLabel: "Calculs & Liste",
    title: "Affichage des dossiers avec badges de statut",
    instructions: [
      "Consulter la liste des calculs sur la fiche d'un client.",
    ],
    expected: "Chaque calcul affiche son badge (Brouillon / Calculé / Validé) et le total des jours d'audit.",
    verificationQuestion: "Les statuts et durées sont-ils clairement indiqués sur chaque carte de calcul ?",
  },

  // --- 4. Wizard Step 1 ---
  {
    id: "SITE-01",
    category: "SITE",
    categoryLabel: "Étape 1: Sites & NACE",
    title: "Recherche de secteur sans accent",
    instructions: [
      "Dans l'étape 1 du calcul, taper 'telecom' (sans accent) dans la recherche de secteur.",
    ],
    expected: "Les secteurs contenant 'Télécommunication' apparaissent dans les suggestions.",
    verificationQuestion: "Les résultats accentués apparaissent-ils même sans taper les accents ?",
  },
  {
    id: "SITE-02",
    category: "SITE",
    categoryLabel: "Étape 1: Sites & NACE",
    title: "Recherche par code NACE ou EAC numérique",
    instructions: [
      "Taper un numéro (ex: '26' ou '33') dans la barre de recherche de secteur.",
    ],
    expected: "Les secteurs dont le code NACE ou EAC contient ce numéro sont proposés.",
    verificationQuestion: "La recherche par code numérique fonctionne-t-elle ?",
  },
  {
    id: "SITE-03",
    category: "SITE",
    categoryLabel: "Étape 1: Sites & NACE",
    title: "Sélection multi-secteurs sans limite arbitraire",
    instructions: [
      "Sélectionner 2 secteurs pour un même site, puis en ajouter un 3ème.",
    ],
    expected: "Tous les secteurs sélectionnés s'affichent sous forme de pastilles (chips). Pas de blocage à 2 secteurs.",
    verificationQuestion: "Pouvez-vous ajouter plus de 2 secteurs pour un site sans blocage ?",
  },
  {
    id: "SITE-04",
    category: "SITE",
    categoryLabel: "Étape 1: Sites & NACE",
    title: "Résolution automatique du niveau de risque retenu",
    instructions: [
      "Sélectionner des secteurs ayant des niveaux de risque différents et au moins une norme active.",
      "Observer l'encadré 'Risque retenu'.",
    ],
    expected: "Le risque affiché retient automatiquement le niveau le plus sévère parmi les secteurs déclarés.",
    verificationQuestion: "Le risque retenu correspond-il bien au niveau le plus sévère ?",
  },
  {
    id: "SITE-05",
    category: "SITE",
    categoryLabel: "Étape 1: Sites & NACE",
    title: "Ajout d'un deuxième site (Multi-sites)",
    instructions: [
      "Cliquer sur '+ Ajouter un site'.",
      "Renseigner un nom différent, des secteurs et des normes.",
    ],
    expected: "Le nouveau site est ajouté avec ses propres données indépendantes.",
    verificationQuestion: "Le deuxième site s'ajoute-t-il avec ses données propres sans écraser le premier ?",
  },

  // --- 5. Wizard Step 2 ---
  {
    id: "NAE-01",
    category: "NAE",
    categoryLabel: "Étape 2: Effectifs",
    title: "Déroulement dynamique des questions d'effectif",
    instructions: [
      "À l'étape 2 (Effectifs), saisir un effectif total de 50.",
      "Saisir ensuite 10 personnes en fonction indirecte.",
    ],
    expected: "La question suivante calcule et affiche exactement le reste : 'Parmi les 40 personnes restantes...'.",
    verificationQuestion: "Le nombre de personnes restantes est-il calculé et affiché dynamiquement ?",
  },
  {
    id: "NAE-02",
    category: "NAE",
    categoryLabel: "Étape 2: Effectifs",
    title: "Gestion progressive des équipes postées",
    instructions: [
      "Renseigner l'effectif non-posté en laissant un solde pour les équipes postées.",
      "Remplir la première équipe : si un solde subsiste, une 2ème ligne apparaît automatiquement.",
    ],
    expected: "Les lignes d'équipes apparaissent automatiquement jusqu'à ce que le solde atteigne 0.",
    verificationQuestion: "Les équipes postées s'ajustent-elles automatiquement sans bouton manuel superflu ?",
  },
  {
    id: "NAE-03",
    category: "NAE",
    categoryLabel: "Étape 2: Effectifs",
    title: "Cohérence multi-sites et navigation intelligente (Smart Next)",
    instructions: [
      "Avec 2 sites, remplir l'effectif du Site 1 correctement et laisser le Site 2 incomplet.",
      "Basculer sur l'onglet du Site 1 : observer le message et le bouton d'action principal.",
    ],
    expected: "Un message clair indique que le Site 1 est complet mais que le Site 2 doit être renseigné. Le bouton principal propose 'Aller à l'effectif de Site 2'.",
    verificationQuestion: "Le bouton principal permet-il de sauter directement vers le site incomplet ?",
  },

  // --- 6. Wizard Step 3 ---
  {
    id: "FAC-01",
    category: "FACTORS",
    categoryLabel: "Étape 3: Facteurs",
    title: "Apparition du panneau Synergie si 2+ normes",
    instructions: [
      "Avec 1 seule norme active, vérifier qu'aucun bloc Synergie n'apparaît.",
      "Avec 2 normes actives (ex: ISO 9001 + ISO 14001), vérifier l'étape Facteurs.",
    ],
    expected: "L'accordéon 'Synergie / Système de management intégré' apparaît uniquement si 2+ normes sont actives.",
    verificationQuestion: "Le bloc Synergie apparaît-il bien uniquement en cas de multi-normes ?",
  },
  {
    id: "FAC-02",
    category: "FACTORS",
    categoryLabel: "Étape 3: Facteurs",
    title: "Indépendance des facteurs par norme",
    instructions: [
      "Cocher des facteurs d'augmentation/réduction sous l'onglet ISO 9001.",
      "Basculer sur l'onglet ISO 14001.",
    ],
    expected: "Les facteurs cochés pour ISO 9001 ne sont pas cochés sur ISO 14001 (chaque norme est indépendante).",
    verificationQuestion: "Les facteurs cochés sur une norme restent-ils bien distincts de l'autre norme ?",
  },

  // --- 7. Wizard Step 4 ---
  {
    id: "REC-01",
    category: "SYNTHESE",
    categoryLabel: "Étape 4: Synthèse",
    title: "Groupement visuel par année d'audit",
    instructions: [
      "Cliquer sur 'Calculer' pour atteindre la Synthèse.",
      "Observer la structure des résultats de durées.",
    ],
    expected: "Visite initiale (Étape 1, Étape 2, Rapport) est regroupée dans un bloc distinct, suivi d'un bloc par année de surveillance.",
    verificationQuestion: "Les blocs d'années sont-ils clairement délimités et lisibles visuellement ?",
  },
  {
    id: "REC-02",
    category: "SYNTHESE",
    categoryLabel: "Étape 4: Synthèse",
    title: "Suggestion de quart de journée (0.25j)",
    instructions: [
      "Observer les durées calculées non entières en quarts de jour.",
    ],
    expected: "Un lien/chip de suggestion gris discret (ex: 'suggestion : 3.75 j') permet d'appliquer la valeur arrondie en un clic.",
    verificationQuestion: "La suggestion au quart de jour le plus proche est-elle cliquable ?",
  },
  {
    id: "REC-03",
    category: "SYNTHESE",
    categoryLabel: "Étape 4: Synthèse",
    title: "Ajustement manuel et réinitialisation",
    instructions: [
      "Modifier une durée avec les boutons + et -.",
      "Observer la mention '(ajusté manuellement)' et l'icône de réinitialisation ↺.",
      "Cliquer sur ↺.",
    ],
    expected: "L'ajustement est immédiat et le bouton ↺ rétablit fidèlement la valeur calculée par le moteur.",
    verificationQuestion: "L'ajustement manuel et la réinitialisation ↺ fonctionnent-ils parfaitement ?",
  },

  // --- 8. Calculation Report ---
  {
    id: "RPT-01",
    category: "REPORT",
    categoryLabel: "Rapport Traçabilité",
    title: "Substitutions numériques complètes dans les formules",
    instructions: [
      "Cliquer sur 'Voir le rapport de calcul complet'.",
      "Consulter le détail de calcul des NAE et des durées de base.",
    ],
    expected: "Les formules affichent les vraies valeurs numériques (ex: 50 + √50 = 57.071), pas seulement des équations abstraites.",
    verificationQuestion: "Les formules contiennent-elles bien les vrais chiffres substitués ?",
  },
  {
    id: "RPT-02",
    category: "REPORT",
    categoryLabel: "Rapport Traçabilité",
    title: "Exhaustivité des justifications de facteurs",
    instructions: [
      "Vérifier la section des facteurs dans le rapport complet.",
    ],
    expected: "Chaque facteur appliqué est nommé précisément avec son pourcentage et la justification renseignée.",
    verificationQuestion: "Les facteurs et leurs justifications sont-ils lisibles dans le rapport ?",
  },

  // --- 9. Navigation ---
  {
    id: "NAV-01",
    category: "NAV",
    categoryLabel: "Navigation & Pile",
    title: "Icône Accueil et fil d'Ariane cohérent",
    instructions: [
      "Dans le wizard, observer la barre supérieure de navigation.",
      "Cliquer sur l'icône Accueil ou le lien 'Clients'.",
    ],
    expected: "L'icône Accueil est située au début du fil d'Ariane et ramène proprement à la racine sans empiler de vues fantômes.",
    verificationQuestion: "La navigation par fil d'Ariane est-elle fluide et sans boucle arrière ?",
  },

  // --- 10. Robustness & Save ---
  {
    id: "SAVE-01",
    category: "SAVE",
    categoryLabel: "Persistance & Retry",
    title: "Autosauvegarde et bouton Réessayer l'enregistrement",
    instructions: [
      "Créer un nouveau calcul.",
      "Vérifier qu'en cas d'erreur de sauvegarde initiale, un message clair et un bouton 'Réessayer l'enregistrement' apparaissent sans geler l'interface.",
    ],
    expected: "L'état d'erreur de draft est explicite et propose une action de réessai directe.",
    verificationQuestion: "L'enregistrement et le réessai de draft sont-ils fiables et sans blocage silencieux ?",
  },
];
