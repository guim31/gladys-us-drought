# US Drought Monitor

Le niveau de sécheresse de votre comté américain, d'après l'**US Drought
Monitor** (USDM), la carte hebdomadaire de la sécheresse aux États-Unis
produite par le National Drought Mitigation Center (université du
Nebraska-Lincoln), l'USDA et la NOAA. Un appareil par comté suivi, avec sa
catégorie de sécheresse, la part du comté dans chaque catégorie et l'évolution
sur 1 et 4 semaines ; des déclencheurs de scène quand la sécheresse s'aggrave,
atteint un niveau ou s'améliore ; une phrase prête pour une notification ; et un
widget aux couleurs de la carte de l'USDM.

L'USDM décrit la sécheresse ; **il ne fixe pas les restrictions d'eau** : elles
sont décidées par votre ville, votre comté ou votre distributeur d'eau.

## Ce que vous obtenez

- un appareil par comté, avec son niveau (0 à 5), sa catégorie (« D2 ·
  Sécheresse sévère »), la part du comté en D1 ou pire, D2 ou pire, D3 ou pire
  et D4, l'évolution sur 1 et 4 semaines et la date de la carte ;
- trois déclencheurs de scène : la sécheresse s'aggrave, atteint un niveau,
  s'améliore ;
- une action de scène qui renvoie la dernière carte en une phrase ;
- un widget avec la part de chaque catégorie en bande colorée, aux couleurs
  officielles de l'USDM.

## Prérequis

- Gladys Assistant 5.3 ou plus récent.
- Un accès à Internet depuis Gladys (services de données de l'USDM, sans compte
  ni clé).
- Le code FIPS à 5 chiffres de votre comté (voir ci-dessous).

## Configuration

1. Trouvez le code FIPS de votre comté : 2 chiffres pour l'État, 3 pour le
   comté. Harris County (Texas) a le code 48201 ; Los Angeles County
   (Californie), 06037. L'US Census les liste tous
   (https://www.census.gov/library/reference/code-lists/ansi.html), et une
   recherche « FIPS code » suivie du nom du comté le donne aussi.
2. Dans l'onglet **Configuration**, saisissez les codes, séparés par des
   virgules, et enregistrez.
3. Créez les appareils dans l'onglet **Découverte**.

### Réglages

- **Codes FIPS des comtés** — 10 comtés au plus. Un code inconnu de l'USDM est
  signalé dans le statut de l'intégration, et aucun appareil n'est proposé pour
  lui. Un code à 4 chiffres est lu avec un zéro devant (6037 vaut 06037).
- **Part nécessaire pour une catégorie** — le niveau d'un comté est la
  catégorie la plus forte qui couvre au moins cette part de sa surface, 1 % par
  défaut. L'USDM dessine ses catégories sur une carte : dans un grand comté, un
  liseré de D3 sur un bord dit peu de chose de votre maison. Choisissez « Toute
  surface » pour suivre la catégorie la plus forte qui touche le comté, ou une
  part plus élevée pour suivre l'essentiel du comté.
- **Langue des noms de fonctionnalités** — noms des nouvelles fonctionnalités,
  et langue de leurs textes (catégories, évolutions, dates, variables de scène
  et résumé).

## Appareils

| Fonctionnalité               | Contenu                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| Niveau de sécheresse (0–5)   | 0 pas de sécheresse, 1 D0 anormalement sec, 2 D1 modérée, 3 D2 sévère, 4 D3 extrême, 5 D4 exceptionnelle |
| Catégorie de sécheresse      | « D2 · Sécheresse sévère », « Pas de sécheresse »                                                        |
| Surface en D1 ou pire        | part du comté en sécheresse, en %                                                                        |
| Surface en D2/D3 ou pire     | part du comté en D2 ou pire, en D3 ou pire, en %                                                         |
| Surface en D4                | part du comté en sécheresse exceptionnelle, en %                                                         |
| Évolution sur 1 / 4 semaines | « D1 → D2, pire · D1+ +12,5 pts » : niveaux, et évolution de la part D1+ en points                       |
| Date de la carte             | le mardi que décrit la carte                                                                             |

D0 (anormalement sec) n'est pas une sécheresse pour l'USDM : il marque une zone
qui entre en sécheresse ou en sort. C'est ici un niveau à part entière.

Les parts suivent l'USDM : « D2 ou pire » comprend D3 et D4. Le niveau, la
catégorie et les parts gardent leur historique.

## Widget du tableau de bord

**Sécheresse (USA)** : le comté choisi (ou le premier suivi), avec son nom dans
Gladys, une bande découpée selon la part de chaque catégorie aux couleurs de la
légende de l'USDM (rouge sombre D4, rouge D3, orange D2, beige D1, jaune D0,
gris sans sécheresse), la catégorie, les parts, les évolutions et la date de la
carte. Chaque bloc peut être masqué dans les réglages du widget.

## Déclencheurs de scène

- **La sécheresse s'aggrave** — une nouvelle carte hebdomadaire place le comté
  dans une catégorie plus forte que la carte précédente.
- **La sécheresse atteint un niveau** — une nouvelle carte place le comté dans
  la catégorie choisie (D0 à D4) ou plus forte, alors qu'il était en dessous.
- **La sécheresse s'améliore** — une nouvelle carte place le comté dans une
  catégorie plus faible.

Chaque déclencheur peut se limiter à un comté. Ils se déclenchent une fois par
nouvelle carte (le jeudi), jamais sur la première carte lue, qui sert de
référence. Variables : comté, catégorie (none, D0 à D4), catégorie précédente,
nom de la catégorie, niveau (0–5), surface en D1 ou pire, date de la carte.

## Action de scène

**Sécheresse : obtenir la carte du comté en une phrase** renvoie, pour le comté
choisi (ou le premier suivi), une phrase comme « Harris County, TX, carte du
3 nov. 2026 : D3 · Sécheresse extrême, 83,2 % du comté en sécheresse (D1+).
Pire qu'il y a 4 semaines. », ainsi que la catégorie, le niveau, les parts et
la date de la carte pour les actions suivantes.

## Exemples de scènes

- La sécheresse atteint D2 → notification « Pensez aux restrictions d'arrosage
  : vérifiez les règles de votre ville. »
- Chaque jeudi soir → obtenir la phrase et l'envoyer sur Telegram.
- La sécheresse s'améliore → remettre l'arrosage du jardin à son programme
  normal.

## Sources des données, licence et quotas

- Services de données de l'US Drought Monitor, `usdmdataservices.unl.edu`,
  statistiques par comté en pourcentage de surface. Sans compte, sans clé, sans
  quota documenté.
- La carte est dessinée avec les données du mardi et publiée le jeudi.
  L'intégration lit chaque comté une fois par jour, et toutes les 3 heures à
  partir du jeudi après-midi (UTC) jusqu'à la nouvelle carte : quelques requêtes
  par comté et par jour.
- « The U.S. Drought Monitor is jointly produced by the National Drought
  Mitigation Center at the University of Nebraska-Lincoln, the United States
  Department of Agriculture, and the National Oceanic and Atmospheric
  Administration. Map courtesy of NDMC. »
- Non affiliée à l'US Drought Monitor, au NDMC, à l'USDA ni à la NOAA.

## Dépannage

- **Aucun appareil dans l'onglet Découverte** — vérifiez les codes FIPS : un
  code inconnu de l'USDM est nommé dans le statut de l'intégration.
- **Statut « illisibles »** — les services de données de l'USDM ne répondent
  pas ; l'intégration réessaie toutes les heures et garde la dernière carte trois
  semaines.
- Journaux : page des journaux de l'intégration dans Gladys ; `LOG_LEVEL=debug`
  pour le détail de chaque lecture.

## Limites

- États-Unis seulement, à l'échelle du comté (ni ville ni code postal).
- Données hebdomadaires : la carte du jeudi décrit le mardi précédent.
- Les restrictions d'eau ne font pas partie de l'USDM : renseignez-vous auprès
  de votre ville ou de votre distributeur d'eau.
- Après trois semaines sans nouvelle carte, les appareils ne reçoivent plus de
  valeurs.
