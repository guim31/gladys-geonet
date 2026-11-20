# GeoNet

Suivez depuis Gladys les volcans de Nouvelle-Zélande et les séismes ressentis autour de votre maison. Les
données viennent de [GeoNet](https://www.geonet.org.nz/), le système de surveillance des risques
géologiques de Nouvelle-Zélande, géré par GNS Science. GeoNet classe chaque volcan (ou champ volcanique)
deux fois :

- le **Volcanic Alert Level**, de 0 (aucune agitation volcanique) à 5 (éruption volcanique majeure) ;
- le **code couleur aviation**, pour les avions : vert, jaune, orange, rouge.

Il calcule aussi l'intensité de chaque séisme de Nouvelle-Zélande sur l'échelle de Mercalli modifiée (MMI) :
la force avec laquelle il est ressenti, pas seulement sa magnitude. Ni compte, ni clé d'API.

C'est un complément, pas un système d'alerte de sécurité : en cas d'urgence, suivez les avis officiels et
la Protection civile (Civil Defence). Non affiliée à GeoNet ni à GNS Science.

**GeoNet ou EMSC ?** L'[intégration EMSC](https://github.com/guim31/gladys-emsc) couvre les séismes du
monde entier, par magnitude, avec les témoignages de ceux qui les ont ressentis. GeoNet ne couvre que la
Nouvelle-Zélande, avec les données officielles du pays : l'intensité calculée par GeoNet, et les niveaux
d'alerte volcanique.

## Ce que vous obtenez

- Un **appareil par volcan suivi** : niveau d'alerte (0 à 5), code couleur aviation, activité (dans les
  mots de GeoNet) et distance à votre maison.
- Un appareil **Volcans de Nouvelle-Zélande** : le niveau d'alerte le plus haut du pays, le nombre de
  volcans au niveau 1 ou plus, et le plus actif.
- Un appareil **Séismes ressentis** : magnitude, intensité, distance et lieu du dernier séisme dans un
  rayon autour de votre maison, et leur nombre sur les dernières 24 heures.
- Un **widget de tableau de bord** : le dernier séisme ressenti et vos volcans, les plus actifs en premier.
- Deux **déclencheurs de scène** : un niveau d'alerte change ; un séisme est ressenti à proximité.
- Une **action de scène** qui lit les niveaux et le dernier séisme en une phrase.

## Prérequis

- Gladys Assistant 5.3 ou plus récent.
- Un accès Internet depuis la machine de Gladys (l'intégration lit `api.geonet.org.nz`).
- Pour les séismes et les distances : la position de votre maison dans Gladys (Paramètres → Maisons), ou
  des coordonnées saisies dans la configuration.

## Configuration

Installez l'intégration depuis le store (ou Intégrations → Installer depuis GitHub, avec l'adresse
`https://github.com/guim31/gladys-geonet`), puis ouvrez son onglet Configuration.

### Réglages

| Réglage                        | Défaut     | Effet                                                                              |
| ------------------------------ | ---------- | ---------------------------------------------------------------------------------- |
| Volcans suivis                 | aucun      | Les volcans à suivre, un appareil chacun                                           |
| Appareil Nouvelle-Zélande      | activé     | Le niveau le plus haut du pays, en appareil et dans le widget                      |
| Rayon                          | 100 km     | Désactivé, 25, 50, 100, 200 ou 300 km entre votre maison et l'épicentre            |
| Intensité minimale             | 3 – faible | Les séismes plus faibles sont ignorés (3 faible, 4 léger, 5 modéré, 6 fort)        |
| Latitude du centre             | vide       | Laissez les deux coordonnées vides pour utiliser la position de votre maison       |
| Longitude du centre            | vide       | Degrés décimaux, est positif (`174.7762`)                                          |
| Intervalle de rafraîchissement | 2 minutes  | 1, 2, 5, 10 ou 15 minutes                                                          |
| Langue des textes              | Français   | Noms des appareils et fonctionnalités (à la création) et textes envoyés aux scènes |

Enregistrez, puis ouvrez l'onglet Découverte et ajoutez à Gladys les appareils voulus. **Afficher les
niveaux actuels** vérifie ce que vos réglages captent.

### Volcans et niveaux d'alerte

Les douze volcans classés par GeoNet : Kermadec Islands (Rangitāhua), Northland, Auckland Volcanic Field,
Mayor Island (Tūhua), Whakaari/White Island, Okataina (Tarawera), Rotorua, Taupō, Tongariro, Ngāuruhoe,
Ruapehu et Taranaki Maunga. Les niveaux 0 à 2 décrivent une agitation sans éruption (0 aucune, 1 mineure,
2 modérée à forte) ; 3 à 5 une éruption (3 mineure, 4 modérée, 5 majeure). Lisez
[les niveaux expliqués par GeoNet](https://www.geonet.org.nz/about/volcano/val) (en anglais).

## Appareils

| Appareil                    | Fonctionnalité               | Valeurs                                                 |
| --------------------------- | ---------------------------- | ------------------------------------------------------- |
| Volcan …                    | Niveau d'alerte volcanique   | 0 à 5                                                   |
|                             | Code couleur aviation        | Pastille de risque : 0 vert, 1 jaune, 2 orange, 3 rouge |
|                             | Activité volcanique          | La phrase de GeoNet, en anglais                         |
|                             | Distance                     | km depuis le centre                                     |
| Volcans de Nouvelle-Zélande | Niveau d'alerte le plus haut | 0 à 5                                                   |
|                             | Volcans au niveau 1 ou plus  | Nombre                                                  |
|                             | Volcan le plus actif         | Nom, niveau et couleur                                  |
| Séismes ressentis           | Magnitude                    | Du dernier séisme dans le rayon                         |
|                             | Intensité (MMI)              | Son intensité, calculée par GeoNet                      |
|                             | Séismes ressentis (24 h)     | Séismes dans le rayon sur les dernières 24 heures       |
|                             | Distance de l'épicentre      | km depuis le centre                                     |
|                             | Dernier séisme ressenti      | Magnitude, intensité, lieu et heure, en texte           |

Les niveaux gardent leur historique. La pastille de Gladys s'arrête à « élevé » (3) : le niveau d'alerte
est un simple nombre pour que les niveaux 4 et 5 restent exacts.

## Widget de tableau de bord

Ajoutez le widget **GeoNet** à un tableau de bord. Il affiche le nombre de volcans au niveau 1 ou plus, le
dernier séisme ressenti, puis vos volcans suivis et, avec l'appareil Nouvelle-Zélande, tout volcan
au-dessus du niveau 0, les plus actifs en premier. Un appui sur une ligne ouvre son détail (phrases de
GeoNet, profondeur du séisme) et un lien vers sa page GeoNet. Réglages : seulement les volcans au-dessus du
niveau 0, afficher le dernier séisme, afficher le lien vers GeoNet.

## Déclencheurs de scène

- **Volcan GeoNet : niveau d'alerte changé** : le niveau ou le code couleur d'un volcan de
  Nouvelle-Zélande change. Filtres : le volcan, le nouveau niveau, en hausse ou en baisse. Variables :
  `volcano`, `alert_level`, `previous_alert_level`, `direction`, `aviation_color`, `aviation_color_name`,
  `activity`, `hazards`, `distance_km`, `summary`, `url`.
- **GeoNet : séisme ressenti à proximité** : un nouveau séisme d'au moins l'intensité minimale, dans le
  rayon, de moins de six heures. Filtre : l'intensité. Variables : `magnitude`, `mmi`, `mmi_name`,
  `distance_km`, `depth_km`, `locality`, `time`, `summary`, `url`.

L'intégration retient ce qu'elle a vu dans `/data` : un redémarrage ne redéclenche rien, et un nouveau
rayon, une nouvelle intensité ou un nouveau centre ne déclenche rien pour les séismes déjà listés.

## Action de scène

**GeoNet : lire les niveaux** renvoie `text` (les volcans affichés et le dernier séisme ressenti, en une
phrase, dans la langue de la configuration), `max_level` (le niveau le plus haut parmi eux, de 0 à 5) et
`elevated_count` (ceux au niveau 1 ou plus). Quand GeoNet ne répond pas, l'action échoue et la scène le
signale.

## Exemples de scènes

- Recevoir un message quand le Ruapehu passe au niveau 2 ou plus : déclencheur « Volcan GeoNet : niveau
  d'alerte changé », filtres « Ruapehu », « Niveau 2 » à « Niveau 5 » et « En hausse », puis envoyer le
  `summary` et l'`url`.
- Allumer les lumières la nuit quand un fort séisme est ressenti : déclencheur « GeoNet : séisme ressenti
  à proximité », filtre « 6 – fort » et au-delà.
- Chaque matin, lire les niveaux à voix haute : déclencheur planifié, action « GeoNet : lire les niveaux »,
  puis dire `text`.

## Sources, conditions et quotas

Les données viennent de GeoNet (GNS Science), par son API publique (`https://api.geonet.org.nz`) :
`/volcano/val` pour les niveaux d'alerte et `/quake?MMI=<n>` pour les 100 derniers séismes d'intensité n ou
plus, à chaque rafraîchissement. Elles sont publiées sous
[licence Creative Commons Attribution 3.0 Nouvelle-Zélande (CC BY 3.0 NZ)](https://creativecommons.org/licenses/by/3.0/nz/) ;
l'intégration cite GeoNet dans le widget. GeoNet ne publie aucun quota : l'intégration demande deux petits
documents par rafraîchissement, toutes les 2 minutes par défaut. Les séismes supprimés par les analystes
sont ignorés.

## Dépannage

- **« Aucun centre pour les séismes et les distances »** : indiquez la position de votre maison dans
  Gladys, ou saisissez des coordonnées.
- **« GeoNet ne répond pas »** : les valeurs restent telles quelles ; l'intégration réessaie au
  rafraîchissement suivant. Vérifiez l'accès Internet de la machine de Gladys.
- **Aucun séisme** : zone plus calme, rayon plus petit ou intensité plus haute ; vérifiez sur
  [geonet.org.nz](https://www.geonet.org.nz/earthquake).
- **Pas de nouvel appareil après un changement de la liste** : ouvrez l'onglet Découverte et ajoutez-le.
- Lancez le conteneur avec `LOG_LEVEL=debug` pour voir chaque rafraîchissement dans ses logs.

## Limites

- Nouvelle-Zélande seulement. L'intensité est celle que GeoNet calcule pour le séisme (sa secousse la plus
  forte attendue), pas une mesure chez vous.
- Un séisme apparaît sur GeoNet quelques minutes après, et ses valeurs peuvent être révisées ; le
  déclencheur part une fois, avec les premières valeurs.
- Les phrases d'activité et de dangers et les lieux sont en anglais, comme GeoNet les écrit.
- La date du dernier changement de niveau n'est connue que par l'observation de l'intégration.
- Quand plus aucun séisme ne reste dans le rayon, la magnitude, l'intensité et la distance gardent les
  valeurs du dernier (leur historique) ; le texte et le compte sur 24 h disent qu'il n'y en a plus.
- Le nom d'un appareil et de ses fonctionnalités est figé à sa création, dans la langue choisie alors.
