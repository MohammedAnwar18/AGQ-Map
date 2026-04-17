import React, { useState, useRef } from 'react';
import { postService } from '../services/api';
import { optimizeImage } from '../utils/imageOptimizer';
import './Modal.css';

// ======================================================
// قائمة نباتات فلسطين - Flora Palestina plant species
// ======================================================
const FLORA_PALESTINA_PLANTS = [
    { ar: 'سَريس / ذرْو', en: 'Chios Mastictree', sci: 'Pistacia lentiscus L.' },
    { ar: 'حَرشَف سوري', en: 'Syrian Artichoke', sci: 'Cynara syriaca Boiss.' },
    { ar: 'حشيشة الدَّبّاغين / سماق', en: 'Sicilian Sumac', sci: 'Rhus coriaria L.' },
    { ar: 'الأسل البحري', en: 'a Rush', sci: 'Juncus maritimus Lam.' },
    { ar: 'نَجمِيَّة وَسيطَة', en: 'Common Chickweed', sci: 'Stellaria media (L.) Vill.' },
    { ar: 'وِدنة', en: 'Round Headed Plantain', sci: 'Plantago lagopus L.' },
    { ar: 'قَتَاد حلب', en: 'Aleppo Milk-vetch', sci: 'Astragalus aleppicus Boiss.' },
    { ar: 'زعتر سبلة', en: 'Spiked Thyme', sci: 'Thymbra spicata L.' },
    { ar: 'قطلب / قيقب / قاتل ابيه', en: 'Eastern Strawberry-tree', sci: 'Arbutus andrachne L.' },
    { ar: 'سِنديان / بلوط', en: 'Kermes Oak', sci: 'Quercus coccifera L.' },
    { ar: 'قَيقَب سوري', en: 'Cyprus Maple', sci: 'Acer obtusifolium Sm.' },
    { ar: 'عَبهَر', en: 'Snowdrop Bush', sci: 'Styrax officinalis L.' },
    { ar: 'قُريص حباني', en: 'Roman Nettle', sci: 'Urtica pilulifera L.' },
    { ar: 'كَرَنب إسباني', en: 'Abyssinian Mustard', sci: 'Crambe hispanica L.' },
    { ar: 'دِبَّيقَة', en: 'Downy Rest Harrow', sci: 'Ononis pubescens L.' },
    { ar: 'حندقوق', en: 'Mediterranean Sweet Clover', sci: 'Melilotus sulcatus Desf.' },
    { ar: 'دُّلْب', en: 'Oriental Plane Tree', sci: 'Platanus orientalis L.' },
    { ar: 'عبَّاد الشَّمس الصَّباغي', en: "Dyer's Litmus", sci: 'Chrozophora tinctoria (L.) A.Juss.' },
    { ar: 'العشار / French-cotton', en: 'Rooster Tree', sci: 'Calotropis procera (Aiton) Aiton fil.' },
    { ar: 'داذي مُثَلَّث الوَرَق / عرنة', en: "Triquetrous Leaved Saint John's Wort", sci: 'Hypericum triquetrifolium Turra' },
    { ar: 'بَلَّان صغيرة', en: 'Burnet Bloodwort', sci: 'Poterium sanguisorba L.' },
    { ar: 'إبرة الراعي', en: 'Alfilaria', sci: "Erodium cicutarium (L.) L'Hér." },
    { ar: 'ثوم القط', en: 'Tall Stonecrop', sci: 'Petrosedum sediforme (Jacq.) Grulich' },
    { ar: 'وَشَعَة حمراء', en: "Jupiter's-beard", sci: 'Centranthus ruber (L.) DC.' },
    { ar: 'زَحّافة زَحّافِيَّة', en: 'False Saw-wort', sci: 'Crupina crupinastrum (Moris) Vis.' },
    { ar: 'اجاص بري', en: 'Syrian Pear', sci: 'Pyrus syriaca Boiss.' },
    { ar: 'لوف / اذن الفيل', en: "Solomon's lily", sci: 'Arum palaestinum Boiss.' },
    { ar: 'ملّول', en: 'Asian Holly Oak', sci: 'Quercus infectoria G. Olivier' },
    { ar: 'بطم', en: 'Cyprus turpentine', sci: 'Pistacia terebinthus L.' },
    { ar: 'فم السمكة', en: 'Sicilian Snapdragon', sci: 'Antirrhinum siculum Mill.' },
    { ar: 'سنام', en: "Golden Dog's-tail / Goldenstop Grass", sci: 'Lamarckia aurea (L.) Moench' },
    { ar: 'قَرناء مُتَجَمّعة', en: 'Clammy Chickweed', sci: 'Cerastium glomeratum Thuill.' },
    { ar: 'ياسَمين بَرّي', en: 'Wild Jasmine', sci: 'Chrysojasminum fruticans (L.) Banfi' },
    { ar: 'شعير إبليس', en: 'Foreign Goat Grass', sci: 'Aegilops peregrina (Hack.) Maire & Weiller' },
    { ar: 'شوفان مُلتَحٍ', en: 'Bearded Oat', sci: 'Avena barbata Pott ex Link' },
    { ar: 'غباشة صَغيرة الزَّهر', en: 'Slender Flowered Gromwell', sci: 'Buglossoides tenuiflora (L.fil.) I.M.Johnst.' },
    { ar: 'شَوك عَنتَر', en: 'Silvery Plumed Thistle', sci: 'Carduus argentatus L.' },
    { ar: 'رُكَب الجَمَل', en: 'White Goosefoot', sci: 'Chenopodium album L.' },
    { ar: 'علدة', en: 'Leafless Shrubby Horsetail', sci: 'Ephedra foeminea Forssk.' },
    { ar: 'أقحوان الحَصيد / وَرد أَصفَر', en: 'Corn Marigold', sci: 'Glebionis segetum (L.) Fourr.' },
    { ar: 'شُبَيط', en: 'Egyptian Alkanet', sci: 'Lycopsis aegyptiaca L.' },
    { ar: 'ابو حربية', en: 'Fine-Leaved Sandwort', sci: 'Minuartia hybrida Vill.' },
    { ar: 'مكانس', en: 'European Millet', sci: 'Piptatherum miliaceum E.Fourn., 1866' },
    { ar: 'سمِرنِيوم مُلتَحِم', en: 'Connate Alexanders', sci: 'Smyrnium connatum Boiss. & Kotschy' },
    { ar: 'فَلَنتِيَة قاسِيَة الوَبَر', en: 'Hispid Valantia', sci: 'Valantia hispida L.' },
    { ar: 'مَلكُلميَة مُفَرَّضَة', en: 'Common Malcolmia', sci: 'Zuvanda crenulata (DC.) Askerova' },
    { ar: 'زيرِفورَة رَأسِيَّة', en: 'Headed Ziziphora', sci: 'Ziziphora capitata L.' },
    { ar: 'عشبة الدم', en: 'Spreading Pellitory', sci: 'Parietaria judaica L.' },
    { ar: 'بيلسان', en: 'Black Elder', sci: 'Sambucus nigra L.' },
    { ar: 'شُبَيط شائِك', en: '', sci: 'Xanthium spinosum L.' },
    { ar: 'شوفان عَقيم / خافور', en: 'Animated Oat', sci: 'Avena sterilis L.' },
    { ar: 'قنطريون شفاف القِنابات', en: 'Transparent-bracted Centaury', sci: 'Centaurea hyalolepis Boiss.' },
    { ar: 'شِبرِق الشائك', en: 'Spiny Restharrow', sci: 'Ononis spinosa L.' },
    { ar: 'لَبلاب خُماسي الفٌصوص', en: 'Two-coloured Bindweed', sci: 'Convolvulus pentapetaloides L.' },
    { ar: 'قُرطُم نحيل / قوص', en: 'Slender Safflower', sci: 'Carthamus tenuis (Boiss. & Blanche) Bornm.' },
    { ar: 'قُصوان الجِمال', en: '', sci: 'Picnomon acarna (L.) Cass.' },
    { ar: 'شِنداب مِنجَلي', en: 'Falcate Eryngo', sci: 'Eryngium falcatum F.Delaroche' },
    { ar: 'مصيص', en: 'Syrian Golden Drop', sci: 'Podonosma orientalis (L.) Feinbrun' },
    { ar: 'سيوان يافا', en: 'Jaffa Cephalaria', sci: 'Cephalaria joppensis (Rchb.) Coult.' },
    { ar: 'قرينة', en: 'Spanish Medick / Disk Trefoil', sci: 'Anthyllis circinnata (L.) D.D.Sokoloff' },
    { ar: 'إبرة الراهب', en: 'Herb Robert', sci: 'Geranium robertianum L.' },
    { ar: 'دُرابة', en: 'Whitetop', sci: 'Lepidium draba L.' },
    { ar: 'فُوَّة نَحيلَة الوَرَق', en: 'Slender Leaved Madder', sci: "Rubia tenuifolia d'Urv." },
    { ar: 'خصيتين الكلب / السحلب الأناضولي', en: 'Anatolian Orchid', sci: 'Orchis anatolica Boiss.' },
    { ar: 'قِثّاء الِحمار', en: 'Squirting Cucumber', sci: 'Ecballium elaterium (L.) A.Rich.' },
    { ar: 'لِسان الكَلب الكِريتي', en: "Cretan Hound's Tongue", sci: 'Cynoglossum creticum Mill.' },
    { ar: 'صفيرة / حلاوي', en: 'Palestine Hawksbeard', sci: 'Crepis palaestina (Boiss.) Bornm.' },
    { ar: 'القرطم الرمادي / قوص', en: 'Glaucus star thistle', sci: 'Carthamus glaucus M.Bieb.' },
    { ar: 'يانسون', en: 'Anise', sci: 'Pimpinella anisum L.' },
    { ar: 'كف مريم / وردة أريحا', en: 'True Rose of Jericho', sci: 'Anastatica hierochuntica L.' },
    { ar: 'عرقسوس / عرق السوس', en: 'Common Liquorice', sci: 'Glycyrrhiza glabra L.' },
    { ar: 'خس صفصافي / خَس بَرّي', en: 'Least Lettuce / Willow-leaved Lettuce', sci: 'Lactuca saligna L.' },
    { ar: 'خيزران / خِلّة', en: "Bullwort / Bishop's Weed", sci: 'Visnaga daucoides Gaertn.' },
    { ar: 'البنجر / سلق', en: 'White Beet / Sea beet', sci: 'Beta vulgaris L.' },
    { ar: 'أَدونيس صَيْفي / عَيْن الحَجَل', en: "Summer pheasant's eye", sci: 'Adonis aestivalis L.' },
    { ar: 'دَوْسَر طَويل', en: 'Goatgrass', sci: 'Aegilops longissima Schweinf. & Muschl.' },
    { ar: 'خِسْمِيَّة لاساقِيَّة / خبز العذرا', en: 'stemless hollyhock', sci: 'Alcea acaulis (Cav.) Alef.' },
    { ar: 'الخطمية / خبيزة الجمال', en: 'Bristly hollyhock', sci: 'Alcea setosa (Boiss.) Alef.' },
    { ar: 'كحلاء غثة / خيلة', en: 'Strigose alkanet', sci: 'Alkanna strigosa Boiss. & Hohen.' },
    { ar: 'شنان / اجرام', en: 'Jointed anabasis', sci: 'Anabasis articulata (Forssk.) Moq.' },
    { ar: 'أذن الفيل / خيار الغنم', en: '', sci: 'Aristolochia bottae Jaub. & Sp.' },
    { ar: 'دريهمه / أرتيديا', en: '', sci: 'Artedia squamata L.' },
    { ar: 'الدانة الصخرية', en: '', sci: 'Ballota saxatilis Sieber ex C.Presl' },
    { ar: 'زهرة الجرس الشوكية', en: '', sci: 'Campanula strigosa Banks & Sol.' },
    { ar: 'قنطريون صغير', en: '', sci: 'Centaurium erythraea Rafn' },
    { ar: 'صبيرة', en: '', sci: 'Coronilla securidaca L.' },
    { ar: 'حشيشة القونة / درهمية', en: '', sci: 'Fibigia clypeata (L.) Medik.' },
    { ar: 'غرنوق', en: '', sci: 'Geranium tuberosum L.' },
    { ar: 'عرق سوس', en: '', sci: 'Glycyrrhiza echinata L.' },
    { ar: 'رقروق سوري', en: '', sci: 'Helianthemum syriacum (Jacq.) Dum.Cours.' },
    { ar: 'رقيب الشمس / غبيرة', en: 'Round-leafed heliotrope', sci: 'Heliotropium rotundifolium Sieber ex Lehm.' },
    { ar: 'سوسن الناصرة', en: '', sci: 'Iris bismarckiana Dammann & Sprenger' },
    { ar: 'الشربين / البقس / العرعر', en: '', sci: 'Juniperus oxycedrus L.' },
    { ar: 'ورخة سرنتية الأوراق', en: '', sci: 'Klasea cerinthifolia (Sm.) Greuter & Wagenitz' },
    { ar: 'البازلاء / الجلبانة', en: '', sci: 'Lathyrus oleraceus Lam.' },
    { ar: 'رشاد عريض الأوراق', en: '', sci: 'Lepidium latifolium L.' },
    { ar: 'سرح سميك الأوراق', en: '', sci: 'Maerua crassifolia Forssk.' },
    { ar: 'الطيطان البحري / نرجس بحري', en: 'Sea Lily', sci: 'Pancratium maritimum L.' },
    { ar: 'خرفار قصير السنابل', en: '', sci: 'Phalaris brachystachys Link' },
    { ar: 'خرفار متناقض', en: 'paradoxical Canary-grass', sci: 'Phalaris paradoxa L.' },
    { ar: 'لِسَان حَمَل كريت', en: 'Cretan Plantain', sci: 'Plantago cretica L.' },
    { ar: 'دوسر أسطواني', en: 'Jointed Goatgrass', sci: 'Aegilops cylindrica Host' },
    { ar: 'صوفان الصُّخور / قَذى', en: 'African Fleabane', sci: 'Phagnalon rupestre (L.) DC.' },
    { ar: 'عورور / بوصير', en: 'Wavyleaf Mullein', sci: 'Verbascum sinuatum L.' },
    { ar: 'خروب', en: 'Carob Tree', sci: 'Ceratonia siliqua L.' },
    { ar: 'نرجس / رُنجس', en: 'Bunch-flowered Daffodil', sci: 'Narcissus tazetta L.' },
    { ar: 'سموة / زقوم', en: 'White Horehound', sci: 'Marrubium vulgare L.' },
    { ar: 'خويخة ناعمة', en: 'Wild Clarey', sci: 'Salvia verbenaca L.' },
    { ar: 'بُنْغَرْدْيَة ذَهَبِيَّة / عُرف الديك', en: "Golden Lady's Nightcap", sci: 'Bongardia chrysogonum (L.) Sp.' },
    { ar: 'لِسان حَمَل إفريقي', en: 'African Plantain', sci: 'Plantago afra L.' },
    { ar: 'زعتر / سعتر', en: 'Biblical Hyssop', sci: 'Origanum syriacum L.' },
    { ar: 'البطنج الفلسطيني', en: 'Palestine Woundwort', sci: 'Stachys palaestina L.' },
    { ar: 'اوركيد الفراشة', en: 'Butterfly Orchid', sci: 'Anacamptis papilionacea (L.) R.M.Bateman, Pridgeon & M.W.Chase' },
    { ar: 'جَعْدَة مُتَشَعِّبة', en: 'Aegean Sage Germander', sci: 'Teucrium divaricatum Sieber ex Heldr.' },
    { ar: 'زعتر رومي / زعتر بيض', en: 'Thyme-leaved Savory', sci: 'Satureja thymbra L.' },
    { ar: 'زعرور / تفاح بري', en: 'Mediterranean-medlar', sci: 'Crataegus azarolus L.' },
    { ar: 'القنفذي أدني الساق', en: 'Globe Thistle', sci: 'Echinops adenocaulos Boiss.' },
    { ar: 'زعتر ناعم', en: 'Veined Savory', sci: 'Micromeria nervosa (Desf.) Benth.' },
    { ar: 'زعتر فارسي / زحيف', en: 'Mediterranean Wild Thyme', sci: 'Thymbra capitata (L.) Cav.' },
    { ar: 'أُقحوان كاذِب', en: 'False Stinking Chamomile', sci: 'Anthemis pseudocotula Boiss.' },
    { ar: 'زقزقة العصفور / إخلييا', en: '', sci: 'Achillea arabica Kotschy' },
    { ar: 'جَزَر بَرّي / إصْطَفْلين', en: "Queen Anne's lace", sci: 'Daucus carota subsp. maximus (Desf.) Ball' },
    { ar: 'أَبو لَيلَة / بو الصّالِح', en: "Poet's-cassia", sci: 'Osyris alba L.' },
    { ar: 'قزمية', en: 'Spring Whitlow Grass', sci: 'Draba minima (C.A.Mey.) Steud.' },
    { ar: 'دوسر ركبي', en: '', sci: 'Aegilops geniculata Roth' },
    { ar: 'رباط', en: 'Rush Hawkweed', sci: 'Tolpis virgata (Desf.) Bertol.' },
    { ar: 'عويذران متعرج / ذهرة القش', en: 'Cut-leaved sea lavender', sci: 'Limonium sinuatum (L.) Mill.' },
    { ar: 'كتان احادي الزهر', en: 'Southern Flax', sci: 'Linum nodiflorum L.' },
    { ar: 'كَتّان رُهابي', en: 'Mucronate Flax', sci: 'Linum mucronatum Bertol.' },
    { ar: 'False Thorow-wax', en: '', sci: 'Bupleurum subovatum Link ex Spreng.' },
    { ar: 'هِيتَيتيرة مُتَباينة الأجنِحة', en: 'Unequal-winged Heptaptera', sci: 'Heptaptera anisoptera (DC.) Tutin' },
    { ar: 'حاجِبية زُنبور', en: 'Late Spider Orchid', sci: 'Ophrys fuciflora (F.W.Schmidt) Moench' },
    { ar: 'اورفيس اصفر / حاجِبِيَّة صفراء', en: 'Yellow Bee Orchid', sci: 'Ophrys lutea subsp. lutea' },
    { ar: 'اوركيد اوفريس اوميغي', en: 'Omega Bee Orchid', sci: 'Ophrys omegaifera subsp. israelitica' },
    { ar: 'سحلب الجليل', en: 'Galilee Orchid', sci: 'Orchis galilaea (Bornm. & M.Schulze) Schltr.' },
    { ar: 'الأوفريس الدبوري', en: 'Early Spider-orchid', sci: 'Ophrys sphegodes Mill.' },
    { ar: 'سحلب هرمي / سحلب ذيل الثعلب', en: 'Pyramidal Orchid', sci: 'Anacamptis pyramidalis (L.) Rich.' },
    { ar: 'سحلب النحله / اوركد الكرمل', en: 'Navel-Like Ophrys', sci: 'Ophrys umbilicata Desf.' },
    { ar: 'فِصَّة قَزِمة', en: 'Little Bur-clover', sci: 'Medicago minima (L.) Bartal.' },
    { ar: 'قَطْرَم مُقَوَّس الزَّهْر / حبق', en: 'Syrian Catnip', sci: 'Nepeta curviflora Boiss.' },
    { ar: 'فجل بري / فُجَّيْلة', en: 'Wild Radish', sci: 'Raphanus raphanistrum L.' },
    { ar: 'سدم أحمر / حيون', en: '', sci: 'Sedum rubens L.' },
    { ar: 'حلحل محمل / بصيلة الفار', en: 'Neglected Muscari', sci: 'Muscari neglectum Guss. ex Ten.' },
    { ar: 'عيصلان / عنصل', en: 'Common asphodel', sci: 'Asphodelus ramosus L.' },
    { ar: 'آذريون الحقول', en: 'Field Marigold', sci: 'Calendula arvensis L.' },
    { ar: 'لوز', en: 'Almond', sci: "Prunus dulcis (Mill.) D.A.Web" },
    { ar: 'سميع / صميعة', en: '', sci: 'Eminium spiculatum (Blume) Schott' },
    { ar: 'بطم اطلسي / بطم اطلنطي', en: 'Atlantic Mastictree', sci: 'Pistacia atlantica Desf.' },
    { ar: 'السراغة الشائكة', en: '', sci: 'Pistacia atlantica Desf' },
    { ar: 'الفصة متعددة الأشكال', en: 'Black Medick', sci: 'Medicago polymorpha L.' },
    { ar: 'الغار / رَند', en: 'Bay', sci: 'Laurus nobilis L.' },
    { ar: 'سدر / نبق', en: "Christ's-thorn", sci: 'Ziziphus spina-christi (L.) Desf.' },
    { ar: 'الكزبرة / كسبره', en: 'coriander', sci: 'Coriandrum sativum L.' },
    { ar: 'فرفحينا / بقلة / فرفحينة', en: 'Purslane', sci: 'Portulaca oleracea L.' },
    { ar: 'زيتون', en: 'Olive', sci: 'Olea europaea L.' },
    { ar: 'بلّوط رومي / بلوط فَش', en: 'Valonia Oak', sci: 'Quercus ithaburensis Decne.' },
    { ar: 'الرشاد / حُرْف', en: 'Garden Cress', sci: 'Lepidium sativum L.' },
    { ar: 'سيبعة', en: '', sci: 'Lotus palaestinus (Boiss. & Blanche) Blatt.' },
    { ar: 'برّيد / الجلثون', en: 'Tawny pea', sci: 'Lathyrus fulvus (Sm.) Kosterin' },
    { ar: 'ورد الكلاب / جوري بري', en: 'Dog Rose', sci: 'Rosa canina L.' },
    { ar: 'آس / آس شائع', en: 'Myrtle', sci: 'Myrtus communis L.' },
    { ar: 'الحلبة العربية / أُذَيْنَة', en: 'Arabian fenugreek', sci: 'Trigonella arabica Delile' },
    { ar: 'سكيك أبو لبن / بَخْراء', en: 'yellow vetch', sci: 'Vicia lutea L.' },
    { ar: 'ذنب الهر / طريش', en: '', sci: 'Typha domingensis Pers.' },
    { ar: 'فول بري / فوّيلة', en: 'French vetch', sci: 'Vicia narbonensis L.' },
    { ar: 'عليق / كْبوش', en: 'Holy Bramble', sci: 'Rubus sanctus Schreb.' },
    { ar: 'قرصعنة / عصا الراعي', en: 'Cretan Eryngo', sci: 'Eryngium creticum Lam.' },
    { ar: 'القبَّار / عُلّيق / الكبار', en: 'Flinders-rose / Cappers', sci: 'Capparis spinosa L.' },
    { ar: 'سلطة الرهبان', en: 'Blowball', sci: 'Taraxacum officinale Weber ex Wiggins' },
    { ar: 'المرْيَمّية / ميرامية', en: 'Greek Oregano', sci: 'Salvia fruticosa Mill.' },
    { ar: 'شومر / رازيانج', en: 'Fennel', sci: 'Foeniculum vulgare Mill.' },
    { ar: 'زعمطوط', en: "Florist's Cyclamen", sci: 'Cyclamen persicum Mill.' },
    { ar: 'قَصِفة عَظيمة / قُفَّة الشَّيخ', en: 'Great Quaking Grass', sci: 'Briza maxima L.' },
    { ar: 'زز الدجاج المتسلق', en: 'White Ramping Fumitory', sci: 'Fumaria capreolata L.' },
    { ar: 'أَلوسن شائك الزَّغَب', en: 'Strigose Madwort', sci: 'Alyssum strigosum Banks & Sol.' },
    { ar: 'كَليلة الورق', en: '', sci: 'Melanortocarya obtusifolia (Willd.) Selvi, Bigazzi, Hilger & Papini' },
    { ar: 'فصة دائرية', en: 'Wheel Medick', sci: 'Medicago rotata Boiss.' },
    { ar: 'نونية فلسطينية', en: 'Philistine Monkswort', sci: 'Nonea philistaea Boiss.' },
    { ar: 'مُشط الزّهرة', en: "Venus' Comb", sci: 'Scandix pecten-veneris L.' },
    { ar: 'دريهمة', en: 'Egyptian Hartwort', sci: 'Tordylium aegyptiacum (L.) Lam.' },
    { ar: 'نفل رغوي', en: 'Mediterranean clover', sci: 'Trifolium spumosum L.' },
    { ar: 'حشيشة الهر', en: 'Bladder Cornsalad', sci: 'Valerianella vesicaria (L.) Moench' },
    { ar: 'حشيشة الصِبيان', en: 'Fine-leaved Fumitory', sci: 'Fumaria parviflora Lam.' },
    { ar: 'توريليس رَهف', en: 'Delicate Hedge-parsley', sci: 'Torilis tenella (Delile) Rchb.fil.' },
    { ar: 'حَوذان ألفي الورق', en: 'Many-leaved Buttercup', sci: 'Ranunculus millefolius Banks & Sol.' },
    { ar: 'نجمة بيت لحم', en: 'Bath Asparagus', sci: 'Ornithogalum narbonense L.' },
    { ar: 'مَلكُلمية خِيوس', en: 'Chian Malcolmia', sci: 'Malcolmia chia (L.) DC.' },
    { ar: 'شحوم', en: 'Netveined Star of Bethlehem', sci: 'Gagea reticulata (Pall.) Schult. & Schult.f.' },
    { ar: 'ذنب الفرس', en: 'Long-beaked Salsify', sci: 'Tragopogon coelesyriacus Boiss.' },
    { ar: 'قصيب', en: 'Italian sugarcane', sci: 'Saccharum ravennae (L.) L.' },
    { ar: 'نعنع', en: 'Spear Mint', sci: 'Mentha spicata L.' },
    { ar: 'خَرّوب الخَنْازير / جَرّود', en: 'Bean Clover', sci: 'Anagyris foetida L.' },
    { ar: 'اسطراغالِس مُعرَّق الثَمَر / بيض الحمار', en: '', sci: 'Astragalus macrocarpus DC.' },
    { ar: 'النفل الاجوف', en: '', sci: 'Trifolium bullatum Boiss. & Hausskn. ex Boiss.' },
    { ar: 'طرخشقون مخزني / جعدة صبيان', en: 'Felty Germander', sci: 'Teucrium capitatum L.' },
    { ar: 'سنارية / حبة البركة', en: '', sci: 'Nigella ciliaris DC.' },
    { ar: 'ذنين الحمار', en: 'Palestine Comfrey', sci: 'Symphytum brachycalyx Boiss.' },
    { ar: 'نفل بيروتي', en: 'Beirut Clover', sci: 'Trifolium berytheum Boiss. & C.I.Blanche' },
    { ar: 'سَذاب حَلَب / الفيجَن / فجم', en: 'Aleppo Rue', sci: 'Ruta chalepensis L.' },
    { ar: 'جلبان / سيسعة القدس', en: 'Jerusalem Vetchling', sci: 'Lathyrus hierosolymitanus Boiss.' },
    { ar: 'أناغيلس الحقول / عُشبة العَلق', en: 'Scarlet Pimpernel', sci: 'Lysimachia arvensis (L.) U.Manns & Anderb.' },
    { ar: 'مرار / قنْطُرْيُون', en: '', sci: 'Centaurea dumulosa Boiss.' },
    { ar: 'مدادة', en: '', sci: 'Convolvulus coelesyriacus Boiss.' },
    { ar: 'لَبلاب متواضع', en: 'Low Bindweed', sci: 'Convolvulus humilis Jacq.' },
    { ar: 'دُخانية سَعترية الورق / شَهترج زعتري', en: 'Clammy Cistus', sci: 'Fumana thymifolia (L.) Spach ex Webb' },
    { ar: 'سَراغَة جاسِئَة', en: "Hawk's-beard", sci: 'Crepis aspera L.' },
    { ar: 'خويخة', en: 'Dominican Sage', sci: 'Salvia dominica L.' },
    { ar: 'خِروع شائع', en: 'Common Palma-christi', sci: 'Ricinus communis L.' },
    { ar: 'بَنج ذهبي', en: 'Golden Henbane', sci: 'Hyoscyamus aureus L.' },
    { ar: 'عين الثور الشائكة', en: 'Spiny Pallenis', sci: 'Pallenis spinosa (L.) Cass.' },
    { ar: 'حُوَيْرَة / London rocket', en: '', sci: 'Sisymbrium irio L.' },
    { ar: 'الصرين الشائع / لوف الحية', en: "Friar's Cowl", sci: 'Arisarum vulgare O.Targ.Tozz.' },
    { ar: 'مَداهين مصري', en: 'Egyptian Sunrose', sci: 'Helianthemum aegyptiacum (L.) Mill.' },
    { ar: 'جِزاب خُبَّيزي / إبرة العجوز', en: "Mediterranean Stork's Bill", sci: "Erodium malacoides (L.) L'Hér." },
    { ar: 'الخشخاش المنثور', en: '', sci: 'Papaver umbonatum Boiss.' },
    { ar: 'سَرو دائم الخُضرَة / سرو', en: 'Mediterranean cypress', sci: 'Cupressus sempervirens L.' },
    { ar: 'قيقب مونبلييه', en: 'Montpellier maple', sci: 'Acer monspessulanum L.' },
    { ar: 'أدونيس حَوْلي / ناب الجَمَل', en: "European pheasant's-eye", sci: 'Adonis annua L.' },
    { ar: 'برنقوس كلخي', en: '', sci: 'Prangos ferulacea (L.) Lindl.' },
    { ar: 'أَدونيس مُسَنَّن / عَيْن العِجْل', en: "toothed pheasant's-eye", sci: 'Adonis dentata Delile' },
    { ar: 'غملول لبناني / كَبَابَة', en: 'Lebanese prickly thrift', sci: 'Acantholimon libanoticum Boiss.' },
    { ar: 'شتيلة / كتيلا', en: 'Sharp Varthemia', sci: 'Chiliadenus iphionoides (Boiss. & Blanche) Brullo' },
    { ar: 'باصول / عنصل عديم الأوراق', en: '', sci: 'Drimia aphylla (Forssk.) J.C.Manning & Goldblatt' },
    { ar: 'القنطريون / المرير', en: '', sci: 'Centaurea iberica Spreng.' },
    { ar: 'عرن مثقوب / حشيشة القلب', en: "Common St. John's wort", sci: 'Hypericum perforatum L.' },
    { ar: 'أداد لبناني / ذند العبد', en: 'Lebanese Carline Thistle', sci: 'Carlina libanotica Boiss.' },
    { ar: 'عُطعاط / بروق أصفر', en: "Jacob's-rod", sci: 'Asphodeline lutea (L.) Rchb.' },
    { ar: 'الثوم البري / ثوم نابولي', en: 'Naples garlic', sci: 'Allium neapolitanum Cirillo' },
    { ar: 'يانسون بري / بسبس', en: '', sci: 'Anethum ridolfia Spalik & Reduron' },
    { ar: 'سزاب البر / كرفس', en: 'celery plant', sci: 'Apium graveolens L.' },
    { ar: 'الشيب / شيبه', en: 'tree wormwood', sci: 'Artemisia arborescens L.' },
    { ar: 'البعيثران / العبيثران', en: '', sci: 'Artemisia judaica L.' },
    { ar: 'خشنة حقلية / Blue woodruff', en: '', sci: 'Asperula arvensis L.' },
    { ar: 'الزقوم / مسيم', en: 'Desert Date', sci: 'Balanites aegyptiaca (L.) Delile' },
    { ar: 'عشبة المنشار / حشيشة المنشار', en: '', sci: 'Biserrula pelecinus L.' },
    { ar: 'الخردل الأسود / فجيله', en: 'Black mustard', sci: "Brassica nigra (L.) W.D.J.Koch" },
    { ar: 'شويعرة مستدقة', en: '', sci: 'Bromus lanceolatus Roth' },
    { ar: 'إسليح بحري', en: 'Sea Rocket', sci: 'Cakile maritima Scop.' },
    { ar: 'أرطاة عربية', en: 'fire bush', sci: "Calligonum comosum L'Hér." },
    { ar: 'الدردار / المرار', en: '', sci: 'Centaurea iberica Trevis. ex Spreng.' },
    { ar: 'سيوان سوري / طردان سوري', en: '', sci: 'Cephalaria syriaca (L.) Schrad.' },
    { ar: 'ملوخية', en: "Mulukhiyah / Jew's mallow", sci: 'Corchorus olitorius L.' },
    { ar: 'نتش', en: '', sci: 'Crotalaria aegyptiaca Benth.' },
    { ar: 'البردي', en: 'Papyrus sedge', sci: 'Cyperus papyrus L.' },
    { ar: 'سليح / الغراء', en: '', sci: 'Erucaria hispanica (L.) Druce' },
    { ar: 'السليح المنقاري', en: '', sci: 'Erucaria pinnata (Viv.) Täckh. & Boulos' },
    { ar: 'تين', en: 'common fig / Fig', sci: 'Ficus carica L.' },
    { ar: 'جينيستا فاسلية', en: '', sci: 'Genista fasselata Decne.' },
    { ar: 'ورد نيسان / خشخاش البحر', en: '', sci: 'Glaucium corniculatum (L.) Rudolph' },
    { ar: 'الماميثا الصفراء', en: 'yellow horned poppy', sci: 'Glaucium flavum Crantz' },
    { ar: 'شعران ثعلبي', en: '', sci: 'Halogeton alopecuroides (Delile) Moq.' },
    { ar: 'الغبيرة الصفراء / عقربانة', en: 'Turnsole', sci: 'Heliotropium europaeum L.' },
    { ar: 'لسان الثور', en: 'Massed alkanet', sci: 'Hormuzakia aggregata (Lehm.) Gusul.' },
    { ar: 'عرن زعتري الأوراق', en: '', sci: 'Hypericum thymifolium Banks & Sol.' },
    { ar: 'السمار / أسل بحري', en: '', sci: 'Juncus acutus L.' },
    { ar: 'عرعر', en: '', sci: 'Juniperus phoenicea L.' },
    { ar: 'رجل الأسد / ركفه', en: "Lion's Foot", sci: 'Leontice leontopetalum L.' },
    { ar: 'زنبق أبيض / السوسن', en: 'Madonna Lily', sci: 'Lilium candidum L.' },
    { ar: 'كتانية زاهية / حلاوة', en: 'Rainbow toadflax', sci: 'Linaria haelava (Forssk.) Delile' },
    { ar: 'زوان متعدد الأزهار', en: 'Italian Rye Grass', sci: 'Lolium multiflorum Lam.' },
    { ar: 'عود الريح الأرجواني / حنائيه', en: 'purple-loosestrife', sci: 'Lythrum salicaria L.' },
    { ar: 'الخبازة / الخبيزة', en: 'common mallow', sci: 'Malva sylvestris L.' },
    { ar: 'لافترية فصلية', en: 'خبازة فصلية', sci: 'Malva trimestris (L.) Salisb.' },
    { ar: 'شجاره', en: 'Pretty Maresia', sci: 'Maresia pulchella (DC.) O.E.Schulz' },
    { ar: 'الملاح / الحمض', en: 'Slender Ice Plant', sci: 'Mesembryanthemum nodiflorum L.' },
    { ar: 'حلم / حماط / عيلان', en: '', sci: 'Moltkiopsis ciliata (Forssk.) I.M.Johnst.' },
    { ar: 'الدفلى', en: 'oleander', sci: 'Nerium oleander L.' },
    { ar: 'حبة البركة / قزحة', en: 'Love-in-a-mist', sci: 'Nigella arvensis L.' },
    { ar: 'غرقد كليل', en: '', sci: 'Nitraria retusa (Forssk.) Asch.' },
    { ar: 'بوص جنوبي / عَقْرَبان', en: 'southern reed', sci: 'Phragmites australis subsp. australis' },
    { ar: 'رِبلَه / لسان الحمل البيضوي', en: 'Ispaghula', sci: 'Plantago ovata Forssk.' },
    { ar: 'زَبَد', en: 'leafy-spiked plantain', sci: 'Plantago squarrosa var. brachystachys Boiss.' },
    { ar: 'خمشه / رصاصية أوروبية', en: '', sci: 'Plumbago europaea L.' },
    { ar: 'بطباط / عصا الراعي', en: 'Common Knotweed', sci: 'Polygonum aviculare L.' },
    { ar: 'قرة الماء / خُزامى', en: 'Mignonette', sci: 'Rapistrum rugosum (L.) All.' },
    { ar: 'مليحة', en: 'Reamuria', sci: 'Reaumuria hirtella Jaub. & Spach' },
    { ar: 'بليحاء / ذَنَبان', en: 'Desert Mignonette', sci: 'Reseda muricata J.Presl' },
    { ar: 'بُلَيْحاء شرقية', en: 'oriental mignonette', sci: 'Reseda orientalis (Müll.Arg.) Boiss.' },
    { ar: 'قصعين أصوف / عُريم', en: 'Wooly sage', sci: 'Salvia lanigera Poir.' },
    { ar: 'السنارية / قرنينة', en: 'spotted golden-thistle', sci: 'Scolymus maculatus L.' },
    { ar: 'شيخة رمادية / قُرّيص', en: 'Jaffa Groundsel', sci: 'Senecio glaucus L.' },
    { ar: 'أبو شفه', en: '', sci: 'Serapias orientalis subsp. levantina' },
    { ar: 'حسانية / شُبَّيْط', en: 'Hooked bristlegrass', sci: 'Setaria verticillata (L.) P.Beauv.' },
    { ar: 'سيلينة عصارية', en: 'Catchfly', sci: 'Silene succulenta Forssk.' },
    { ar: 'خردل أبيض / خردل بري', en: 'White mustard', sci: 'Sinapis alba L.' },
    { ar: 'المغد / خدك', en: 'Nightshade', sci: 'Solanum incanum L.' },
    { ar: 'كاكول', en: 'Seablite', sci: 'Suaeda aegyptiaca (Hasselq.) Zohary' },
    { ar: 'سويداء أسفلتية', en: 'Asphaltic Sea-Blite', sci: 'Suaeda asphaltica (Boiss.) Boiss.' },
    { ar: 'خريزه / عدبه', en: '', sci: 'Tetraena dumosa (Boiss.) Beier & Thulin' },
    { ar: 'متنان', en: '', sci: 'Thymelaea hirsuta (L.) Endl.' },
    { ar: 'دريس / الحسك', en: 'small caltrops', sci: 'Tribulus terrestris L.' },
    { ar: 'الحلبة الاسطوانية', en: '', sci: 'Trigonella cylindracea Desv.' },
    { ar: 'الكرسنة', en: '', sci: 'Vicia ervilia (L.) Willd.' },
    { ar: 'رجل الحمامة / فضّية', en: 'Silvery whitlow wort', sci: 'Paronychia argentea Lam.' },
    { ar: 'ميس / مَيْس جَنوبي', en: 'European hackberry', sci: 'Celtis australis L.' },
    { ar: 'تومة العرب / بصل العفريت', en: 'Wild Leek', sci: 'Allium ampeloprasum L.' },
    { ar: 'لبيد ابيض / الهنبل الابيض', en: 'Sage-leaved Rockrose', sci: 'Cistus salviifolius L.' },
    { ar: 'السنارية الاسبانية', en: 'Golden Thistle', sci: 'Scolymus hispanicus L.' },
    { ar: 'شِبْرِق لَزِج', en: 'Sticky Restharrow', sci: 'Ononis viscosa L.' },
    { ar: 'عنّاب', en: 'Chinese Jujube', sci: 'Ziziphus jujuba Mill.' },
    { ar: 'دم المسيح / دم الغزال', en: 'Red Everlasting', sci: 'Helichrysum sanguineum (L.) Kostel.' },
    { ar: 'زمزريق شائع', en: 'Judas Tree', sci: 'Cercis siliquastrum L.' },
    { ar: 'سَنا كاذب / وَحْواح', en: "Steven's Meadow Saffron", sci: 'Colchicum stevenii Kunth' },
    { ar: 'زرود عريض الاوراق / البرزة', en: 'Mock Privet', sci: 'Phillyrea latifolia L.' },
    { ar: 'حمحم / لسان الثور', en: 'Prickly Alkanet', sci: 'Anchusa strigosa Banks & Sol.' },
    { ar: 'تفاح المجانين / شجّيع', en: 'Mandrake', sci: 'Mandragora officinarum L.' },
    { ar: 'كيس الراعي / جِراب الراعي', en: "Shepherd's-purse", sci: 'Capsella bursa-pastoris (L.) Medik.' },
    { ar: 'شَقائق النُّعْمان / الحنون / الدحنون', en: 'Poppy Anemone', sci: 'Anemone coronaria L.' },
    { ar: 'لسينة / الحفحاف', en: 'Jerusalem Salvia', sci: 'Salvia hierosolymitana Boiss.' },
    { ar: 'جعدة الصبيان / فَيْرونِكَة جَعْدِيَّة الورق', en: 'Poley', sci: 'Teucrium polium L.' },
    { ar: 'البليس الحرجي / قيحوان', en: 'Common Daisy', sci: 'Bellis sylvestris Cirillo' },
    { ar: 'خردل / لِفَّيْتَة', en: 'California-rape', sci: 'Sinapis arvensis L.' },
    { ar: 'خرفيش / مرار', en: 'Syrian Thistle', sci: 'Notobasis syriaca (L.) Cass.' },
    { ar: 'جُمَّيْز', en: 'Mulberry fig', sci: 'Ficus sycomorus L.' },
    { ar: 'طيون / طيّوب', en: 'Woody Fleabane', sci: 'Dittrichia viscosa (L.) Greuter' },
    { ar: 'بطيخ بري / بندورة الحية', en: '', sci: 'Bryonia syriaca Boiss.' },
    { ar: 'قرين', en: '', sci: 'Hypecoum dimidiatum Delile' },
    { ar: 'نفل حبي / برسيم كروي', en: 'Ball Cotton Clover', sci: 'Trifolium pilulare Boiss.' },
    { ar: 'كتان زهري', en: 'Hairy Pink Flax', sci: 'Linum pubescens Banks & Sol.' },
    { ar: 'شَقال كَبير / شوقال', en: 'White Hedge-nettle', sci: 'Prasium majus L.' },
    { ar: 'قرن الغزال / زنبق / تيولب', en: "Sun's-eye Tulip", sci: 'Tulipa agenensis Redouté' },
    { ar: 'سوسن فلسطين', en: 'Palestine Iris', sci: 'Iris palaestina (Baker) Barbey' },
    { ar: 'قُنطُريون صغير دقيق الزهر', en: 'Slender-flowered Centaurium', sci: 'Centaurium tenuiflorum (Hoffmanns. & Link) Fritsch' },
    { ar: 'دلبوث / سوسن الحقل', en: 'Italian Gladiolus', sci: 'Gladiolus italicus Mill.' },
    { ar: 'خس الحمار / خس بري', en: 'Prickly Lettuce', sci: 'Lactuca serriola L.' },
    { ar: 'بابونج / قُمَيْلَة', en: '', sci: 'Matricaria aurea (Loefl.) Sch.Bip.' },
    { ar: 'الصدأ', en: 'Rustyback Fern', sci: 'Asplenium ceterach L.' },
    { ar: 'قرص ستي', en: 'Button Clover', sci: 'Medicago orbicularis (L.) Bartal.' },
    { ar: 'ابرة العجوز / إبرة الراهب', en: 'Iranian stork\'s bill', sci: "Erodium gruinum (L.) L'Hér." },
    { ar: 'برّيد / Common Vetch', en: '', sci: 'Vicia sativa L.' },
    { ar: 'بريد الحية', en: 'Yellow Pea', sci: 'Lathyrus aphaca L.' },
    { ar: 'كسيكسة الحية', en: 'Broad-pod vetch', sci: 'Vicia peregrina L.' },
    { ar: 'عدس بري', en: 'Lentil', sci: 'Vicia orientalis (Boiss.) Bég. & Diratz.' },
    { ar: 'حِمَّص ريشي التَّخْريم / حُمّص بري', en: 'Pennatifid Chickpea', sci: 'Cicer pinnatifidum Jaub. & Spach' },
    { ar: 'سكيك أبو لبن / بيقِيَّة هَجينة', en: '', sci: 'Vicia hybrida L.' },
    { ar: 'كركم / شحيمة / زعفران', en: 'Winter crocus', sci: 'Crocus hyemalis Boiss. & Blanche' },
    { ar: 'القورنِيه', en: 'Classical Fenugreek', sci: 'Trigonella foenum-graecum L.' },
    { ar: 'هِنْدَبا بَرّية', en: 'Belgium endive', sci: 'Cichorium intybus L.' },
    { ar: 'حميض', en: 'Spiny threecornerjack', sci: 'Rumex spinosus L.' },
    { ar: 'زهرة الحواشي السورية', en: 'Syrian Speedwell', sci: 'Veronica syriaca Roem. & Schult.' },
    { ar: 'خرفيش / خرفيش الجمل', en: '', sci: 'Silybum marianum (L.) Gaertn.' },
    { ar: 'حمصيص / حميمصة', en: '', sci: 'Rumex cyprius Murb.' },
    { ar: 'فِصَّة زراعية / قُتات', en: 'Lucerne', sci: 'Medicago sativa L.' },
    { ar: 'طُبّاق / الخبّيزة', en: 'Egyptian mallow', sci: 'Malva parviflora L.' },
    { ar: 'نعناع / دَبّاب', en: 'European pennyroyal', sci: 'Mentha pulegium L.' },
    { ar: 'عين البنت', en: 'Colored Catchfly', sci: 'Silene colorata Poir.' },
    { ar: 'خَنازيرِيَّة صَفراء السَّداة', en: 'Yellow Scaled Figwort', sci: 'Scrophularia xanthoglossa Boiss.' },
    { ar: 'نوارة المرج', en: 'Annual Clary', sci: 'Salvia viridis L.' },
    { ar: 'ذنبة', en: 'White Mignonette', sci: 'Reseda alba L.' },
    { ar: 'لبينه / الحلبلوب', en: 'Sun Spurge', sci: 'Euphorbia helioscopia L.' },
    { ar: 'عكّوب / كعّوب', en: "Tournefort's gundelia", sci: 'Gundelia tournefortii L.' },
    { ar: 'السيلينة المصرية', en: 'Egyptian Campion', sci: 'Silene aegyptiaca (L.) L.fil.' },
    { ar: 'شِبْرِق ثُعباني / Yellow Restharrow', en: '', sci: 'Ononis natrix L.' },
    { ar: 'حنا الغول / كَحلَة', en: "Narrow-leaved Viper's Bugloss", sci: 'Echium angustifolium Mill.' },
    { ar: 'لسينة الجنوب', en: 'Judean Sage', sci: 'Salvia judaica Boiss.' },
    { ar: 'حَوذان آسيَوي', en: 'Persian Crowfoot', sci: 'Ranunculus asiaticus L.' },
    { ar: 'بَقلَة الغزال', en: 'Cretan Germander', sci: 'Teucrium creticum L.' },
    { ar: 'لبّيد زهري / غبرة', en: 'Pink rockrose', sci: 'Cistus creticus L.' },
    { ar: 'سويد / زَفرين فلسطيني', en: 'Palestine Buckthorn', sci: 'Rhamnus lycioides L.' },
    { ar: 'الاذينة الدبقة / رِكاب الجِمال', en: 'Shrubby Jerusalem Sage', sci: 'Phlomis viscosa Poir.' },
    { ar: 'عناب / رُبّيض', en: 'Lotus', sci: 'Ziziphus lotus (L.) Lam.' },
    { ar: 'عوينة', en: 'Arabian Scurfpea', sci: 'Bituminaria bituminosa (L.) C.H.Stirt.' },
    { ar: 'قنديل / القندول', en: 'Spiny Broom', sci: 'Calicotome villosa (Poir.) Link' },
    { ar: 'هَليون / عجرم', en: 'Mediterranean Asparagus', sci: 'Asparagus aphyllus L.' },
    { ar: 'عليق', en: 'Common Smilax', sci: 'Smilax aspera L.' },
    { ar: 'الكلخ الشائع / قِنَّة', en: 'Giant Fennel', sci: 'Ferula communis L.' },
    { ar: 'عِلْت / عِلك', en: 'Small Chicory', sci: 'Cichorium pumilum Jacq.' },
    { ar: 'كف مريم', en: 'Chasteberry', sci: 'Vitex agnus-castus L.' },
    { ar: 'القنطريون الكحلي', en: 'Syrian Cornflower-thistle', sci: 'Centaurea cyanoides Berggr. & Wahlenb.' },
    { ar: 'الحُميَّض', en: 'Bladder Dock', sci: 'Rumex vesicarius L.' },
    { ar: 'قُرَة العَيْن / رَشاد', en: 'Water-cress', sci: 'Nasturtium officinale R.Br.' },
    { ar: 'بسباس / البسّوم', en: 'Japanese-green', sci: 'Glebionis coronaria (L.) Tzvelev' },
    { ar: 'إكرير أَزَبّ / غبيرة زغبية', en: 'Hairy Heliotrope', sci: 'Heliotropium hirsutissimum Grauer' },
    { ar: 'جلبان / جُلْبان رُخامي', en: 'Marbled Vetchling', sci: 'Lathyrus marmoratus Boiss. & Balansa' },
    { ar: 'جلبان أصفر', en: 'Cyprus Vetch', sci: 'Lathyrus ochrus (L.) DC.' },
    { ar: 'جُلْبان كُرَوي / Grass pea', en: '', sci: 'Lathyrus sphaericus Retz.' },
    { ar: 'البلّان / نتش', en: 'Thorny Burnet', sci: 'Sarcopoterium spinosum (L.) Spach' },
    { ar: 'هِرْشْفِلديَة مُبْيَضَّة / لفّيت', en: 'Hoary Mustard', sci: 'Hirschfeldia incana (L.) Lagr.-Foss.' },
    { ar: 'بيقِيَّة فلسطينية / قُصَيْقصَة', en: 'Vetch', sci: 'Vicia palaestina Boiss.' },
    { ar: 'سِتّ خديجة / الشيّح', en: 'Spanish Broom', sci: 'Spartium junceum L.' },
    { ar: 'حلبة', en: '', sci: 'Trigonella berythea Boiss. & C.I.Blanche' },
    { ar: 'غاشية / حَبْل مِسكي', en: "Early Virgin's-bower", sci: 'Clematis cirrhosa L.' },
    { ar: 'نعنع بري / نعنع ميّه', en: 'Biblical Mint', sci: 'Mentha longifolia (L.) Huds.' },
    { ar: 'غاجِيَة مُخضَرة الزَّهرة', en: 'Green Flowered Gagea', sci: 'Gagea chlorantha (M.Bieb.) Schult. & Schult.f.' },
    { ar: 'قرنفل / اسليلة', en: '', sci: 'Dianthus strictus Banks & Sol.' },
    { ar: 'عُوَيْنة البَقَرَة / الخُطمِيّة', en: 'Holly Hock', sci: 'Alcea setosa Alef.' },
    { ar: 'زعتر بلاط / زعتمان', en: '', sci: 'Clinopodium serpyllifolium (M.Bieb.) Kuntze' },
    { ar: 'ترمس بري / فول الضبع', en: 'Blue Lupin', sci: 'Lupinus pilosus L.' },
    { ar: 'خس بري / ذبح', en: 'Tuberous Lettuce', sci: 'Lactuca tuberosa Jacq.' },
    { ar: 'قتاد نجمي / قَفعَة', en: '', sci: 'Astragalus asterias Steven' },
    { ar: 'اسطراغالِس صِنّاري / قُرَيْن', en: 'European milkvetch', sci: 'Astragalus hamosus L' },
    { ar: 'حنون البس / دَم النَُعْمان', en: "Small pheasant's-eye", sci: 'Adonis microcarpa DC.' },
    { ar: 'كف الدب / السورية', en: "Syrian Bear's Breech", sci: 'Acanthus hirsutus subsp. syriacus (Boiss.) Brummitt' },
    { ar: 'زعتر سيدنا موسى', en: 'Wild basil', sci: 'Clinopodium insulare (Candargy) Govaerts' },
    { ar: 'خُرْفَيْش الحَمير / حَرْشَف سوري', en: '', sci: 'Cynara syriaca Boiss.' },
    { ar: 'حويريه / غُرَيْرَة', en: 'White Rocket', sci: 'Diplotaxis erucoides (L.) DC.' },
    { ar: 'لسان البقرة / وريقة', en: 'Bristly Oxtongue', sci: 'Helminthotheca echioides (L) Holub' },
    { ar: 'شَعير بَصَلي / سبيلة', en: 'Bulbous barley', sci: 'Hordeum bulbosum L.' },
    { ar: 'اذن البس', en: "Cat's ear", sci: 'Hypochaeris radicata L.' },
    { ar: 'بلبوس وبري / بصيل ازرق', en: '', sci: 'Leopoldia comosa (L.) Parl.' },
    { ar: 'سلطان الجبل / زهر العسل', en: 'Etruscan Honeysuckle', sci: 'Lonicera etrusca Santi' },
    { ar: 'لوطس طويل العلبة', en: '', sci: 'Lotus longesiliquosus R.Roem.' },
    { ar: 'تُرُنْجان مَخْزَني / حَشيشَة النَّحْل', en: 'Balm', sci: 'Melissa officinalis L.' },
    { ar: 'حمصيص / حُمَّيْضَة', en: 'African wood-sorrel', sci: "Oxalis pes-caprae L." },
    { ar: 'بُخيتة / الخشخاش', en: 'حنون عرايس', sci: 'Papaver humile Fedde' },
    { ar: 'فُجَّيْلة / فجل بري', en: 'Jointed charlock', sci: 'Raphanus raphanistrum subsp. rostratus (DC.) Thell.' },
    { ar: 'فزر محيطي الاوراق', en: 'Perfoliate Ironwort', sci: 'Sideritis perfoliata L.' },
    { ar: 'سيلينة شائعة', en: 'Bladder campion', sci: 'Silene vulgaris (Moench) Garcke' },
    { ar: 'بطنج كريتي / قرطوم', en: 'Mediterranean Woundwort', sci: 'Stachys cretica L.' },
    { ar: 'نفل مدرع / بزاز البقر', en: 'Shield Clover', sci: 'Trifolium clypeatum L.' },
    { ar: 'نفل صوفي الكرات', en: 'Woolly Round Head Clover', sci: 'Trifolium eriosphaerum Boiss.' },
    { ar: 'نفل متكىء / Persian Clover', en: '', sci: 'Trifolium resupinatum var. resupinatum' },
    { ar: 'البيقية الجليلية', en: '', sci: 'Vicia galilaea Plitmann & Zohary' },
    { ar: 'بيقية ربيعية', en: '', sci: 'Vicia lathyroides L.' },
    { ar: 'بيقية حريرية الثمر', en: 'Silky Fruited Vetch', sci: 'Vicia sericocarpa Fenzl' },
    { ar: 'بيقية وَبِرَة', en: 'Fodder Vetch', sci: 'Vicia villosa Roth' },
    { ar: 'عشبة الدم / Ground Pine', en: '', sci: 'Ajuga chamaepitys (L.) Schreb' },
    { ar: 'السوسن العادي', en: 'Afternoon Iris', sci: 'Moraea sisyrinchium (L.) Ker Gawl.' },
    { ar: 'بصيلة الفار / بُصّيل متدلي', en: 'Common Roman Squill', sci: 'Bellevalia flexuosa Boiss.' },
    { ar: 'Annual Kidney Vetch', en: '', sci: 'Tripodion tetraphyllum (L.) Fourr.' },
    { ar: 'سحلب مسنن', en: 'Three Toothed Orchid', sci: 'Neotinea tridentata (Scop.) R.M.Bateman' },
    { ar: 'ورد الجرس / لِفْت بَرّي', en: 'Rampion Bellflower', sci: 'Campanula rapunculus L.' },
    { ar: 'إشقيل خزامي / عنصلان', en: 'Hyacinth Bluebell', sci: 'Scilla hyacinthoides L.' },
    { ar: 'عصا الراعي / Common Pennywort', en: '', sci: 'Umbilicus horizontalis var. intermedius (Boiss.) Chamb.' },
    { ar: 'فيرونيكا صنجية', en: 'Glandular speedwell', sci: 'Veronica cymbalaria Bodard' },
    { ar: 'الكَرْمُ البَرِّيُّ', en: 'Black Bryony', sci: 'Dioscorea orientalis (J.Thiébaut) Caddick & Wilkin' },
    { ar: 'الحلبوب / Jerusalem Spurge', en: '', sci: 'Euphorbia hierosolymitana Boiss.' },
    { ar: 'قرنة', en: 'Disk trefoil', sci: 'Anthyllis circinnata (L.) D.D.Sokoloff' },
    { ar: 'قريصة الدجاجة', en: 'Musk Deadnettle', sci: 'Lamium moschatum Mill.' },
    { ar: 'شاهترج كثيف الزهر', en: 'Dense-flowered Fumitory', sci: 'Fumaria densiflora DC.' },
    { ar: 'خوذية / رأس الهر', en: "Giraffe's head", sci: 'Lamium amplexicaule L.' },
    { ar: 'مخدة العروس / ربحلة', en: "Oriental Viper's Grass", sci: 'Pseudopodospermum papposum (DC.) Zaika, Sukhor. & N.Kilian' },
    { ar: 'شيتُسكيَديوم أشعَر البزرة', en: 'Hairy-Seeded Chervil', sci: 'Chaetosciadium trichospermum Linnaeus, 1767' },
    { ar: 'خرمان كَلَبرِيا', en: 'Fetid Field-Madder', sci: 'Plocama calabrica (L.f.) M.Backlund & Thulin' },
    { ar: 'سدم صغيرة الثمر', en: 'Small-fruited Stonecrop', sci: 'Sedum microcarpum (Sibth. & Sm.) Schönland' },
    { ar: 'ذنب الفرس الرفيع', en: 'Slender Salsify', sci: 'Geropogon hybridus (L.) Sch.Bip.' },
    { ar: 'بِسكوتِلة مُهَدَّبة', en: 'Buckler Mustard', sci: 'Biscutella didyma L.' },
    { ar: 'نفل لبدي / برسيم', en: 'Woolly Clover', sci: 'Trifolium tomentosum L.' },
    { ar: 'نفل نجمي', en: 'Star Clover', sci: 'Trifolium stellatum L.' },
    { ar: 'نفل حرشفي', en: 'Rough Clover', sci: 'Trifolium scabrum L.' },
    { ar: 'نفل ارجواني / أبو دَلابيش', en: 'Purple Clover', sci: 'Trifolium purpureum Loisel.' },
    { ar: 'نفل داسيوري', en: 'Eastern Star Clover', sci: 'Trifolium dasyurum C.Presl' },
    { ar: 'نقل حقلي / قرطة صفراء', en: 'Hop Clover', sci: 'Trifolium campestre Schreb.' },
    { ar: 'أم الحليب / لِبَّيْن', en: 'Common Sowthistle', sci: 'Sonchus oleraceus L.' },
    { ar: 'نبات اليرقة / عنجدة', en: 'Caterpillar Plant', sci: 'Scorpiurus muricatus L.' },
    { ar: 'حميص', en: '', sci: 'Rumex pictus Forssk.' },
    { ar: 'شبرق ثنائي الأزهار', en: 'Two-flowered Restharrow', sci: 'Ononis biflora Desf.' },
    { ar: 'شبرق ثعلبي / وسبة', en: "Salzmann's Restharrow", sci: 'Ononis alopecuroides L.' },
    { ar: 'ضرس العجوز / دُرّيس', en: 'Cockscomb Sainfoin', sci: 'Onobrychis crista-galli (L.) Lam.' },
    { ar: 'فِصَّة خَشِنَة / دحديلة', en: 'Gama Medic', sci: 'Medicago rugosa Desr.' },
    { ar: 'فصة لولبية', en: 'Southern Medick', sci: 'Medicago turbinata (L.) All.' },
    { ar: 'فصة برميلية', en: 'Barrelclover', sci: 'Medicago truncatula Gaertn.' },
    { ar: 'فصة حرشفية', en: 'Shield Medick', sci: 'Medicago scutellata (L.) Mill.' },
    { ar: 'فصة تاجية', en: 'Crown Medick', sci: 'Medicago coronata (L.) Bartal.' },
    { ar: 'فِصَّة بْلانْش', en: "Blanche's Medick", sci: 'Medicago blancheana Boiss.' },
    { ar: 'قرن الغزال / طقوش حية', en: "Bird's Foot Trefoil", sci: 'Lotus peregrinus L.' },
    { ar: 'حذوة الفرس', en: 'Common Horseshoe Vetch', sci: 'Hippocrepis unisiliquosa L.' },
    { ar: 'مُصَلبة مِفصَلية', en: 'Jointed Mugwort', sci: 'Cruciata articulata (L.) Ehrend.' },
    { ar: 'ثلسبي مخروق', en: 'Perfoliate Pennycress', sci: 'Noccaea perfoliata (L.) Al-Shehbaz' },
    { ar: 'أقحوان / البسّوم', en: 'Palestinian Chamomile', sci: 'Cota palaestina Reut. ex Unger & Kotschy' },
    { ar: 'خُوَيْتِمَة / حويذان', en: 'Annual Scorpion Vetch', sci: 'Coronilla scorpioides (L.) W.D.J.Koch' },
];

// ID of the Flora Palestina community (adjust if needed)
const FLORA_PALESTINA_COMMUNITY_ID = 6;

const CreatePostModal = ({ currentLocation, onClose, onPostCreated, communityId }) => {
    const [content, setContent] = useState('');
    const [images, setImages] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedPlant, setSelectedPlant] = useState('');
    const [plantSearch, setPlantSearch] = useState('');
    const [showPlantDropdown, setShowPlantDropdown] = useState(false);

    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    // هل المجتمع الحالي هو نباتات فلسطين؟ (نستخدم == لتجاهل فرق string/number)
    // eslint-disable-next-line eqeqeq
    const isFloraComm = communityId == FLORA_PALESTINA_COMMUNITY_ID;

    // الاسم المركّب للنبتة المختارة
    const selectedPlantLabel = selectedPlant
        ? `${selectedPlant.ar}${selectedPlant.en ? ' / ' + selectedPlant.en : ''} — ${selectedPlant.sci}`
        : '';

    // تصفية قائمة النباتات بحسب البحث
    const filteredPlants = FLORA_PALESTINA_PLANTS.filter(p => {
        const q = plantSearch.toLowerCase();
        return (
            p.ar.toLowerCase().includes(q) ||
            p.en.toLowerCase().includes(q) ||
            p.sci.toLowerCase().includes(q)
        );
    });

    // اختيار صورة
    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);

        let validFiles = [];
        let validPreviews = [];

        files.forEach(file => {
            if (communityId && !file.type.startsWith('image/')) {
                setError('فقط الصور مسموحة في المجتمعات');
                return;
            }
            if (file.size > 20 * 1024 * 1024) {
                setError('تم تجاهل ملفات أكبر من 20MB');
                return;
            }
            validFiles.push(file);
            validPreviews.push(URL.createObjectURL(file));
        });

        setImages(prev => [...prev, ...validFiles]);
        setImagePreviews(prev => [...prev, ...validPreviews]);

        // إذا في مجتمع النباتات والصورة التُقطت — أظهر اختيار النبتة
        if (isFloraComm && validFiles.length > 0) {
            setShowPlantDropdown(true);
        }
    };

    // إزالة الصورة
    const removeImage = (index) => {
        const newImages = [...images];
        const newPreviews = [...imagePreviews];

        URL.revokeObjectURL(newPreviews[index]);
        newImages.splice(index, 1);
        newPreviews.splice(index, 1);

        setImages(newImages);
        setImagePreviews(newPreviews);

        if (newImages.length === 0) {
            setShowPlantDropdown(false);
            setSelectedPlant('');
            setPlantSearch('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // حالة النجاح
    const [success, setSuccess] = useState(false);

    // نشر المنشور
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!currentLocation) {
            setError('لم نتمكن من الحصول على موقعك. يرجى السماح بالوصول للموقع.');
            return;
        }

        if (!content && images.length === 0) {
            setError('يرجى إضافة صورة أو نص على الأقل');
            return;
        }

        // في مجتمع النباتات: الصورة شرط
        if (isFloraComm && images.length === 0) {
            setError('يرجى التصوير أولاً قبل النشر في مجتمع نباتات فلسطين');
            return;
        }

        try {
            setLoading(true);
            setError('');

            // بناء المحتوى النهائي مع اسم النبتة إن وُجد
            let finalContent = content;
            if (isFloraComm && selectedPlant) {
                const plantTag = `🌿 ${selectedPlant.ar}${selectedPlant.en ? ' / ' + selectedPlant.en : ''}\n📋 ${selectedPlant.sci}`;
                finalContent = finalContent
                    ? `${finalContent}\n\n${plantTag}`
                    : plantTag;
            }

            const formData = new FormData();
            formData.append('content', finalContent);
            formData.append('latitude', currentLocation.latitude);
            formData.append('longitude', currentLocation.longitude);
            if (communityId) {
                formData.append('community_id', communityId);
            }

            // Optimize images before upload
            for (const img of images) {
                const optimizedFile = await optimizeImage(img, { maxWidth: 1200, quality: 0.7 });
                formData.append('media', optimizedFile);
            }

            // Reverse Geocoding
            try {
                const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
                const geocodeResponse = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${currentLocation.longitude},${currentLocation.latitude}.json?access_token=${mapboxToken}`
                );
                const geocodeData = await geocodeResponse.json();
                if (geocodeData.features && geocodeData.features.length > 0) {
                    formData.append('address', geocodeData.features[0].place_name);
                }
            } catch (geocodeError) {
                console.error('Geocoding failed:', geocodeError);
            }

            const result = await postService.createPost(formData);

            setSuccess(true);
            setTimeout(() => {
                onPostCreated(result.post);
            }, 1500);

        } catch (err) {
            setError(err.response?.data?.error || 'فشل نشر المنشور');
            console.error('Create post error:', err);
            setLoading(false);
        }
    };

    // تنظيف عند الإغلاق
    const handleClose = () => {
        imagePreviews.forEach(url => URL.revokeObjectURL(url));
        onClose();
    };

    if (success) {
        return (
            <div className="modal-overlay">
                <div className="modal-container glass" style={{
                    maxWidth: '430px',
                    padding: '3rem',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))'
                }}>
                    <div className="success-overlay-content">
                        <div className="success-icon-wrapper">
                            <div className="success-circle-bg"></div>
                            <div className="success-circle-main">
                                <svg className="checkmark-smooth" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                    <path d="M20 6L9 17l-5-5" />
                                </svg>
                            </div>
                        </div>
                        <div className="success-text-container">
                            <h3 className="success-title">تم النشر بنجاح!</h3>
                            <p className="success-subtitle">شكراً لك، جاري تحديث الخريطة...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()} style={isFloraComm ? { maxWidth: '480px' } : {}}>
                <div className="modal-header" style={isFloraComm ? {
                    background: 'linear-gradient(135deg, #15803d, #166534)',
                    borderBottom: '1px solid rgba(134,239,172,0.2)'
                } : {}}>
                    <h2 style={isFloraComm ? { color: '#dcfce7' } : {}}>
                        {isFloraComm ? 'توثيق نبتة 🌿' : 'منشور جديد'}
                    </h2>
                    <button className="btn-close" onClick={handleClose} style={isFloraComm ? { color: '#bbf7d0' } : {}}>✕</button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body" style={isFloraComm ? { padding: '16px' } : {}}>
                    {error && (
                        <div className="error-message">
                            <span className="error-icon">⚠️</span>
                            {error}
                        </div>
                    )}

                    {/* ===== Flora: عرض الصورة الملتقطة بشكل بطاقة كبيرة ===== */}
                    {isFloraComm && imagePreviews.length > 0 && (
                        <div style={{
                            position: 'relative',
                            width: '100%',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            marginBottom: '16px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                            border: '2px solid rgba(134,239,172,0.3)'
                        }}>
                            <img
                                src={imagePreviews[0]}
                                alt="صورة النبتة"
                                style={{
                                    width: '100%',
                                    maxHeight: '320px',
                                    objectFit: 'cover',
                                    display: 'block'
                                }}
                            />
                            {/* زر الحذف */}
                            <button
                                type="button"
                                onClick={() => removeImage(0)}
                                style={{
                                    position: 'absolute',
                                    top: '10px',
                                    right: '10px',
                                    background: 'rgba(239,68,68,0.85)',
                                    backdropFilter: 'blur(8px)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                                }}
                            >✕</button>

                            {/* بادج النبتة المختارة فوق الصورة */}
                            {selectedPlant && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '0',
                                    left: '0',
                                    right: '0',
                                    background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                                    padding: '30px 14px 12px 14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <span style={{ fontSize: '1.3rem' }}>🌿</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            color: '#bbf7d0',
                                            fontWeight: 'bold',
                                            fontSize: '0.95rem',
                                            fontFamily: 'inherit',
                                            direction: 'rtl',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {selectedPlant.ar}{selectedPlant.en ? ` / ${selectedPlant.en}` : ''}
                                        </div>
                                        <div style={{
                                            color: 'rgba(255,255,255,0.7)',
                                            fontSize: '0.78rem',
                                            fontStyle: 'italic',
                                            fontFamily: 'inherit'
                                        }}>
                                            {selectedPlant.sci}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ===== الوضع العادي (ليس Flora): معاينة الوسائط ===== */}
                    {!isFloraComm && imagePreviews.length > 0 && (
                        <div className="media-preview-container" style={{
                            display: 'flex',
                            gap: '10px',
                            overflowX: 'auto',
                            padding: '10px 0',
                            whiteSpace: 'nowrap'
                        }}>
                            {imagePreviews.map((preview, index) => (
                                <div key={index} className="image-preview" style={{
                                    flex: '0 0 auto',
                                    width: '150px',
                                    height: '150px',
                                    position: 'relative'
                                }}>
                                    <img src={preview} alt={`Preview ${index}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                                    <button
                                        type="button"
                                        className="btn-remove-image"
                                        onClick={() => removeImage(index)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                            {/* زر إضافة المزيد */}
                            <label style={{
                                flex: '0 0 auto',
                                width: '150px',
                                height: '150px',
                                border: '2px dashed #ccc',
                                borderRadius: '8px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                cursor: 'pointer',
                                background: 'transparent',
                                color: '#ccc',
                                fontSize: '2rem'
                            }}>
                                +
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>
                    )}

                    {/* أزرار الإضافة الأولية */}
                    {imagePreviews.length === 0 && (
                        <div className="image-actions">
                            {/* زر الكاميرا */}
                            <label className="btn btn-secondary" style={{
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                background: isFloraComm ? 'linear-gradient(135deg, #16a34a, #15803d)' : undefined,
                                color: isFloraComm ? 'white' : undefined,
                                fontWeight: isFloraComm ? 'bold' : undefined,
                                borderRadius: isFloraComm ? '14px' : undefined,
                                padding: isFloraComm ? '14px 20px' : undefined,
                                fontSize: isFloraComm ? '1rem' : undefined
                            }}>
                                {isFloraComm ? '📸 التقط صورة النبتة' : '📷 فتح الكاميرا'}
                                <input
                                    type="file"
                                    ref={cameraInputRef}
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                            </label>

                            {/* زر اختيار الملفات — فقط خارج مجتمع النباتات */}
                            {!isFloraComm && (
                                <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    🖼️ اختيار ملفات
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept="image/*,video/*"
                                        multiple
                                        onChange={handleFileChange}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            )}
                        </div>
                    )}

                    {/* ===== اختيار اسم النبتة — يظهر بعد التصوير في مجتمع النباتات ===== */}
                    {isFloraComm && imagePreviews.length > 0 && (
                        <div style={{
                            marginTop: '6px',
                            background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
                            borderRadius: '16px',
                            padding: '16px',
                            border: '1px solid #bbf7d0'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '12px'
                            }}>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontWeight: 'bold',
                                    color: '#15803d',
                                    fontFamily: 'inherit',
                                    fontSize: '0.95rem'
                                }}>
                                    🌱 تصنيف النبتة
                                </label>
                                <span style={{
                                    fontSize: '0.75rem',
                                    color: '#86efac',
                                    background: '#166534',
                                    padding: '3px 10px',
                                    borderRadius: '20px',
                                    fontWeight: '600'
                                }}>اختياري</span>
                            </div>

                            {/* حقل البحث المحسّن */}
                            <div style={{ position: 'relative', marginBottom: '10px' }}>
                                <input
                                    type="text"
                                    placeholder="🔍 ابحث بالعربية، الإنجليزية أو الاسم العلمي..."
                                    value={plantSearch}
                                    onChange={e => setPlantSearch(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: '2px solid #86efac',
                                        borderRadius: '12px',
                                        fontSize: '0.9rem',
                                        fontFamily: 'inherit',
                                        direction: 'rtl',
                                        background: 'white',
                                        outline: 'none',
                                        transition: 'border-color 0.2s, box-shadow 0.2s',
                                        boxSizing: 'border-box'
                                    }}
                                    onFocus={e => {
                                        e.target.style.borderColor = '#16a34a';
                                        e.target.style.boxShadow = '0 0 0 3px rgba(22,163,74,0.15)';
                                    }}
                                    onBlur={e => {
                                        e.target.style.borderColor = '#86efac';
                                        e.target.style.boxShadow = 'none';
                                    }}
                                />
                            </div>

                            {/* عرض الاختيار الحالي كبطاقة */}
                            {selectedPlant && (
                                <div style={{
                                    marginBottom: '10px',
                                    padding: '12px 14px',
                                    background: 'linear-gradient(135deg, #166534, #15803d)',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    boxShadow: '0 4px 12px rgba(22,101,52,0.3)'
                                }}>
                                    <span style={{ fontSize: '1.6rem' }}>🌿</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontWeight: 'bold',
                                            color: '#dcfce7',
                                            fontFamily: 'inherit',
                                            direction: 'rtl',
                                            fontSize: '0.95rem'
                                        }}>
                                            {selectedPlant.ar}
                                            {selectedPlant.en && <span style={{ color: '#bbf7d0', fontWeight: 'normal' }}> / {selectedPlant.en}</span>}
                                        </div>
                                        <div style={{
                                            fontSize: '0.78rem',
                                            color: '#86efac',
                                            fontStyle: 'italic',
                                            fontFamily: 'inherit',
                                            marginTop: '2px'
                                        }}>
                                            {selectedPlant.sci}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedPlant('')}
                                        style={{
                                            background: 'rgba(255,255,255,0.15)',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#dcfce7',
                                            fontSize: '0.9rem',
                                            padding: '4px 8px',
                                            borderRadius: '8px',
                                            transition: 'background 0.15s'
                                        }}
                                    >✕</button>
                                </div>
                            )}

                            {/* القائمة المنسدلة */}
                            <div style={{
                                maxHeight: '220px',
                                overflowY: 'auto',
                                borderRadius: '12px',
                                background: 'white',
                                border: '1px solid #d1fae5',
                                boxShadow: '0 2px 8px rgba(21,128,61,0.08)'
                            }}>
                                {/* خيار "بدون تصنيف" */}
                                <div
                                    onClick={() => { setSelectedPlant(''); setPlantSearch(''); }}
                                    style={{
                                        padding: '11px 14px',
                                        cursor: 'pointer',
                                        color: '#64748b',
                                        fontSize: '0.88rem',
                                        fontFamily: 'inherit',
                                        borderBottom: '1px solid #f0fdf4',
                                        background: selectedPlant === '' ? '#f0fdf4' : 'transparent',
                                        transition: 'background 0.15s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                                    onMouseLeave={e => e.currentTarget.style.background = selectedPlant === '' ? '#f0fdf4' : 'transparent'}
                                >
                                    <span style={{ fontSize: '1rem' }}>🚫</span> بدون تصنيف
                                </div>

                                {filteredPlants.map((plant, idx) => {
                                    const isSelected = selectedPlant && selectedPlant.sci === plant.sci;
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => {
                                                setSelectedPlant(plant);
                                                setPlantSearch('');
                                            }}
                                            style={{
                                                padding: '10px 14px',
                                                cursor: 'pointer',
                                                background: isSelected ? '#dcfce7' : 'transparent',
                                                borderBottom: idx < filteredPlants.length - 1 ? '1px solid #f0fdf4' : 'none',
                                                transition: 'background 0.15s',
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '10px'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = isSelected ? '#dcfce7' : '#f0fdf4'}
                                            onMouseLeave={e => e.currentTarget.style.background = isSelected ? '#dcfce7' : 'transparent'}
                                        >
                                            <span style={{
                                                fontSize: '1.1rem',
                                                marginTop: '2px',
                                                filter: isSelected ? 'none' : 'grayscale(0.5)'
                                            }}>{isSelected ? '✅' : '🌱'}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    fontWeight: '600',
                                                    color: '#166534',
                                                    fontSize: '0.93rem',
                                                    fontFamily: 'inherit',
                                                    direction: 'rtl'
                                                }}>
                                                    {plant.ar}
                                                </div>
                                                {plant.en && (
                                                    <div style={{
                                                        color: '#4b7c59',
                                                        fontSize: '0.8rem',
                                                        fontFamily: 'inherit'
                                                    }}>
                                                        {plant.en}
                                                    </div>
                                                )}
                                                <div style={{
                                                    color: '#94a3b8',
                                                    fontSize: '0.75rem',
                                                    fontStyle: 'italic',
                                                    fontFamily: 'inherit'
                                                }}>
                                                    {plant.sci}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {filteredPlants.length === 0 && plantSearch && (
                                    <div style={{
                                        padding: '20px 14px',
                                        color: '#94a3b8',
                                        textAlign: 'center',
                                        fontFamily: 'inherit',
                                        fontSize: '0.88rem'
                                    }}>
                                        لا توجد نتائج لـ «{plantSearch}»
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* النص / الوصف */}
                    <div className="form-group" style={isFloraComm ? { marginTop: '12px' } : {}}>
                        <label htmlFor="content">
                            {isFloraComm ? 'ملاحظات (اختياري)' : 'الوصف (اختياري)'}
                        </label>
                        <textarea
                            id="content"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="input textarea"
                            placeholder={isFloraComm
                                ? 'أضف ملاحظاتك عن الموقع، الموسم، الحالة...'
                                : 'اكتب وصفاً لمنشورك...'}
                            rows={isFloraComm ? "3" : "4"}
                        />
                    </div>

                    {/* معلومات الموقع */}
                    {currentLocation && (
                        <div className="location-info">
                            <span className="location-icon">📍</span>
                            <span className="location-text">
                                الموقع: {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
                            </span>
                        </div>
                    )}

                    {/* زر النشر */}
                    <button
                        type="submit"
                        className="btn btn-primary btn-submit"
                        disabled={loading}
                        style={isFloraComm ? {
                            background: 'linear-gradient(135deg, #16a34a, #15803d)',
                            boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
                            borderRadius: '14px',
                            fontSize: '1rem',
                            padding: '14px'
                        } : {}}
                    >
                        {loading ? (
                            <>
                                <div className="spinner-small"></div>
                                جاري النشر...
                            </>
                        ) : (
                            isFloraComm ? 'نشر التوثيق 🌿' : 'نشر'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreatePostModal;

