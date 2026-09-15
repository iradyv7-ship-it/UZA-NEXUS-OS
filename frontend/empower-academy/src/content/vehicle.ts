import type { Module } from "./types";

export const vehicleModules: Module[] = [
  {
    id: "v1",
    track: "vehicle",
    code: "V1",
    title: { en: "From the old Avensis to a 2025 electric car", rw: "Kuva kuri Avensis ishaje ukagera ku modoka y'amashanyarazi yo mu 2025" },
    why: {
      en: "You have kept a 1998 manual diesel alive for years with your ears, your hands and a screwdriver. The new car is quieter, simpler in some ways, and unforgiving in others. This module maps what changed.",
      rw: "Wamaze imyaka ubeshaho imodoka ya mazutu yo mu 1998 ukoresheje amatwi, intoki na tuluvise. Imodoka nshya iracecetse, yoroshye mu bintu bimwe, ikaba ikomeye mu bindi. Iri somo rikwereka ibyahindutse.",
    },
    minutes: 50,
    delivery: "both",
    remember: [
      { en: "No engine oil, no clutch, no gearbox, no exhaust, no spark plugs.", rw: "Nta mavuta ya moteri, nta kilagi, nta boyite ya vitesi, nta pot d'échappement, nta bougie." },
      { en: "But: tyres, brakes, suspension, coolant and the 12V battery still exist — and still fail.", rw: "Ariko: amapine, amaferi, amaresori, amazi akonjesha na batiri ya 12V biracyahari — kandi biracyangirika." },
    ],
    lessons: [
      {
        id: "v1l1",
        title: { en: "What disappeared, what stayed", rw: "Ibyagiye n'ibyagumye" },
        body: [
          { en: "Gone: engine oil changes, filters, timing belt, clutch, gears, fuel pump, exhaust smoke, and most of the noise. Roughly two thirds of the old service list no longer applies.", rw: "Byagiye: guhindura amavuta, ama filtre, umukandara wa moteri, kilagi, vitesi, pompe ya lisansi, umwotsi, n'urusaku rwinshi. Hafi bibiri bya gatatu by'ibisanzwe bisuzumwa ntibikiriho." },
          { en: "Stayed: tyres, wheel alignment, brakes, suspension, steering, lights, wipers, air conditioning, cabin filter, coolant for the battery system, and a small 12V battery that still dies if the car sits too long.", rw: "Byagumye: amapine, gutunganya amapine, amaferi, amaresori, ivolant, amatara, ama esuiglace, ikonjesha ry'imbere, filtre y'umwuka, amazi akonjesha bateri nkuru, na batiri nto ya 12V iracyapfa iyo imodoka imaze igihe kirekire ihagaze." },
          { en: "New: the traction battery, the charging port, regenerative braking, and software that tells you the truth if you learn to read it.", rw: "Bishya: bateri nkuru, aho uziza umuriro, amaferi asubiza ingufu (regen), na sisitemu ya mudasobwa ikubwira ukuri iyo wize kuyisoma." },
        ],
        practice: { en: "Walk around a car with the trainer and name each part in Kinyarwanda. Point at what no longer exists.", rw: "Zenguruka imodoka n'umutoza uvuge izina rya buri gice mu Kinyarwanda. Yereka ibitakiriho." },
        facilitator: { en: "Do this at the vehicle, not on paper. Open the bonnet of an old sedan and the new EV side by side if possible.", rw: "Ibi bikorere ku modoka, atari ku mpapuro. Nibishoboka, fungura kapo y'imodoka ishaje n'iy'amashanyarazi mubigereranye." },
      },
      {
        id: "v1l2",
        title: { en: "Automatic driving: no clutch, instant power", rw: "Gutwara otomatike: nta kilagi, imbaraga ako kanya" },
        body: [
          { en: "Two pedals only. Left foot rests — never use it for braking. D for drive, R for reverse, P for park, and the handbrake or auto-hold on hills.", rw: "Ama pedale abiri gusa. Ikirenge cy'ibumoso kiraruhuka — ntukigire ukoresha ku maferi. D ni ukugenda, R ni ugusubira inyuma, P ni uguhagarara, na fureni y'ukuboko cyangwa auto-hold ku misozi." },
          { en: "Electric power arrives immediately — there is no waiting for revs. On wet Kigali tarmac this can spin a wheel or surprise a passenger. Press gently.", rw: "Imbaraga z'amashanyarazi ziza ako kanya — nta gutegereza moteri izamuke. Ku muhanda utose i Kigali ibi bishobora gutuma ipine rizunguruka cyangwa umugenzi agatungurwa. Kanda buhoro." },
          { en: "The car is silent at low speed. Pedestrians will step in front of you because they did not hear you. Assume you are invisible near markets and schools.", rw: "Imodoka iracecetse ku muvuduko muke. Abanyamaguru bazakwambuka imbere kuko batakumvise. Fata nk'aho utagaragara hafi y'amasoko n'amashuri." },
        ],
        practice: { en: "In a safe yard: start, move off, stop, reverse, park, three times without touching a brake harshly.", rw: "Ahantu hatekanye: tangira, ugende, uhagarare, usubire inyuma, uparike, incuro eshatu utakanze feri cyane." },
      },
      {
        id: "v1l3",
        title: { en: "Reading the dashboard: % instead of a fuel needle", rw: "Gusoma tabaro: ijanisha aho gukoresha urushinge rwa lisansi" },
        body: [
          { en: "The battery percentage is your fuel gauge. The range in kilometres next to it is an estimate — it changes with AC, hills, load and driving style.", rw: "Ijanisha rya bateri ni yo jauge ya lisansi. Ibirometero bigaragara iruhande ni ugereranya — bihinduka bitewe n'ikonjesha, imisozi, imizigo, n'uko utwara." },
          { en: "Learn three numbers on your car: percentage now, kilometres remaining, and consumption (kWh per 100 km). The third one tells you whether you are driving expensively.", rw: "Menya imibare itatu ku modoka yawe: ijanisha ubu, ibirometero bisigaye, n'ikoreshwa ry'ingufu (kWh kuri km 100). Uwa gatatu ukubwira niba utwara mu buryo buhenze." },
          { en: "Warning lights still mean the same thing they meant on the Avensis: red means stop safely and call, amber means check today.", rw: "Amatara y'iburira aracyafite icyo asobanura nk'uko byari kuri Avensis: umutuku bisobanura guhagarara neza uhamagare, umuhondo bisobanura gusuzuma uyu munsi." },
        ],
        practice: { en: "Photograph your dashboard at the start and end of one shift. Compare the two percentages and the kilometres driven.", rw: "Fata ifoto ya tabaro mu ntangiriro no ku iherezo ry'akazi k'umunsi. Gereranya amajanisha yombi n'ibirometero wagenze." },
      },
    ],
    quiz: [
      {
        id: "v1q1",
        question: { en: "Which of these does an electric car NOT need?", rw: "Ni ikihe muri ibi imodoka y'amashanyarazi ITAKENEYE?" },
        options: [
          { en: "Engine oil change", rw: "Guhindura amavuta ya moteri" },
          { en: "Brake inspection", rw: "Gusuzuma amaferi" },
          { en: "Tyre pressure check", rw: "Gusuzuma umwuka mu mapine" },
        ],
        answer: 0,
        explain: { en: "There is no combustion engine, so no engine oil. Brakes and tyres still matter.", rw: "Nta moteri itwikwa ibaho, bityo nta mavuta ya moteri. Amaferi n'amapine biracyari ngombwa." },
      },
      {
        id: "v1q2",
        question: { en: "Why is a silent car a risk near markets?", rw: "Kuki imodoka iceceka ari akaga hafi y'amasoko?" },
        options: [
          { en: "It uses more power", rw: "Ikoresha ingufu nyinshi" },
          { en: "Pedestrians do not hear it coming", rw: "Abanyamaguru ntibumva iza" },
          { en: "The brakes are weaker", rw: "Amaferi aba adakomeye" },
        ],
        answer: 1,
        explain: { en: "Assume people cannot hear you; drive slower and watch feet, not faces.", rw: "Fata nk'aho abantu batakumva; genda buhoro urebe ibirenge, atari mu maso." },
      },
    ],
  },

  {
    id: "v2",
    track: "vehicle",
    code: "V2",
    title: { en: "Charging: where, when, and the 20–80 rule", rw: "Kuzuza umuriro: hehe, ryari, n'itegeko rya 20–80" },
    why: {
      en: "Charging is your new fuel station, and it behaves differently. Charge well and the battery lasts years longer — which is money, because the battery is the most expensive part of the car.",
      rw: "Kuzuza umuriro ni yo sitasiyo yawe nshya ya lisansi, kandi bikora ukundi. Uzuza neza, bateri imara imyaka myinshi — ni amafaranga, kuko bateri ari cyo gice gihenze cyane ku modoka.",
    },
    minutes: 60,
    delivery: "both",
    remember: [
      { en: "Daily habit: keep the battery between 20% and 80%.", rw: "Umuco wa buri munsi: gumisha bateri hagati ya 20% na 80%." },
      { en: "Charge to 100% only when you truly need the range, and leave soon after.", rw: "Uzuza kugera kuri 100% gusa iyo ukeneye urugendo rurerure by'ukuri, hanyuma ugende vuba." },
      { en: "Fast charging every day ages the battery faster than slow overnight charging.", rw: "Kuzuza vuba buri munsi bisaza bateri kurusha kuzuza buhoro nijoro." },
    ],
    lessons: [
      {
        id: "v2l1",
        title: { en: "Slow charging, fast charging, and cost", rw: "Kuzuza buhoro, kuzuza vuba, n'ikiguzi" },
        body: [
          { en: "Slow (AC) charging takes hours and is gentle on the battery. It is the cheapest and should be your normal overnight routine.", rw: "Kuzuza buhoro (AC) bifata amasaha kandi ntibigirira nabi bateri. Ni byo bihendutse kandi bigomba kuba umuco wawe wa buri joro." },
          { en: "Fast (DC) charging fills you in tens of minutes. Use it when you are working and need to get back on the road, not as your default.", rw: "Kuzuza vuba (DC) byuzuza mu minota mike. Bikoreshe iyo uri ku kazi ukeneye gusubira ku muhanda, atari uko byaba ari byo bisanzwe." },
          { en: "Know the price per kWh at each point you use, and write it in your expense log. Charging cost is your biggest running cost — treat it like fuel price.", rw: "Menya igiciro cya kWh kuri buri kigo ukoresha, ukibike mu nyandiko z'ibyasohotse. Ikiguzi cyo kuzuza umuriro ni cyo kinini mu biciro byawe — gifate nk'igiciro cya lisansi." },
        ],
        practice: { en: "List the charging points you can reach in your working area, with price and speed for each.", rw: "Andika ibigo byo kuzuza umuriro ushobora kugeraho aho ukorera, ushyireho igiciro n'umuvuduko kuri buri kimwe." },
        facilitator: { en: "Build the list together on the board as a shared map of the city. Drivers know spots the trainer does not.", rw: "Mwubake urwo rutonde hamwe ku kibaho nk'ikarita rusange y'umujyi. Abashoferi bazi ahantu umutoza atazi." },
      },
      {
        id: "v2l2",
        title: { en: "Why 20–80 protects your money", rw: "Impamvu 20–80 birinda amafaranga yawe" },
        body: [
          { en: "A battery is happiest in the middle. Sitting at very full or very empty, especially in heat, wears it faster.", rw: "Bateri iba nzima cyane iri hagati. Kuguma yuzuye cyane cyangwa yashize cyane, cyane cyane mu bushyuhe, biyisaza vuba." },
          { en: "So: plug in at around 20–30%, stop around 80% for daily work, and do not leave the car parked at 100% for days.", rw: "Bityo: kwiza umuriro uri hafi 20–30%, uhagarare hafi 80% ku kazi ka buri munsi, kandi ntugasige imodoka iparitse kuri 100% iminsi myinshi." },
          { en: "Do not run to 0%. Deep empty is the one habit that damages a battery fastest, and it also leaves you stranded far from a charger.", rw: "Ntugatware kugeza kuri 0%. Gushira burundu ni wo muco wangiza bateri vuba kurusha ibindi, kandi bigusiga uhagaze kure y'aho kuzuza." },
        ],
        practice: { en: "Set a personal rule: plug in tonight when you reach 25%. Follow it for one week.", rw: "Ishyirire itegeko: kwiza umuriro uyu mugoroba ugeze kuri 25%. Rikurikize icyumweru kimwe." },
      },
      {
        id: "v2l3",
        title: { en: "Charging safely and planning a shift", rw: "Kuzuza umuriro utekanye no gutegura umunsi w'akazi" },
        body: [
          { en: "Use the cable and socket the trainer approves. Never use a damaged cable, never charge in standing water, and never join cables together.", rw: "Koresha insinga na priz umutoza yemeje. Ntukoreshe insinga yangiritse, ntuzuze umuriro mu mazi ahagaze, kandi ntuzahuze insinga ebyiri." },
          { en: "Plan the day around one charging stop, not five. A stop at lunch, in a place where you can also eat and rest, costs you nothing extra in time.", rw: "Tegura umunsi ufite ihagarara rimwe ryo kuzuza, atari eshanu. Guhagarara ku manywa ahantu ushobora no kurya no kuruhuka ntibigutwara igihe cy'inyongera." },
          { en: "Keep a reserve rule: never start a long trip below 40%, and never accept a far client below 30% without a charging plan.", rw: "Gumana itegeko ry'ingoboka: ntutangire urugendo rurerure uri munsi ya 40%, kandi ntukemere umukiriya wa kure uri munsi ya 30% udafite gahunda yo kuzuza." },
        ],
        practice: { en: "Plan tomorrow on paper: expected trips, where you will charge, and at what percentage.", rw: "Tegura ejo ku rupapuro: ingendo witeze, aho uzuriza umuriro, n'ijanisha uzabaho." },
      },
    ],
    quiz: [
      {
        id: "v2q1",
        question: { en: "What is the best daily charging range?", rw: "Ni irihe janisha ryiza ryo kuzuza rya buri munsi?" },
        options: [
          { en: "0% to 100% every day", rw: "0% kugeza 100% buri munsi" },
          { en: "20% to 80%", rw: "20% kugeza 80%" },
          { en: "Always keep it at 100%", rw: "Guhora kuri 100%" },
        ],
        answer: 1,
        explain: { en: "The middle range keeps the battery healthy for years.", rw: "Hagati ni ho bateri iguma nzima imyaka myinshi." },
      },
      {
        id: "v2q2",
        question: { en: "You will drive to Musanze tomorrow. What do you do tonight?", rw: "Ejo uzajya i Musanze. Ukora iki uyu mugoroba?" },
        options: [
          { en: "Charge slowly to a high level and leave early", rw: "Uzuza buhoro ugere ku janisha riri hejuru hanyuma ugende kare" },
          { en: "Leave it at 30% and find a charger on the way", rw: "Usige kuri 30% ushakire kuzuza mu nzira" },
          { en: "Nothing, range is always enough", rw: "Nta cyo, urugendo buri gihe ruhagije" },
        ],
        answer: 0,
        explain: { en: "Long trips are the correct time to charge high — slowly, overnight, and leave soon after.", rw: "Ingendo ndende ni cyo gihe cyo kuzuza cyane — buhoro, nijoro, ugende vuba nyuma yaho." },
      },
    ],
  },

  {
    id: "v3",
    track: "vehicle",
    code: "V3",
    title: { en: "The daily and weekly check", rw: "Isuzuma rya buri munsi n'irya buri cyumweru" },
    why: {
      en: "An old car warns you with noise and smoke. A new EV is silent, so problems arrive without a sound. Five minutes of looking every morning replaces the ear you used to trust.",
      rw: "Imodoka ishaje ikuburira ikoresheje urusaku n'umwotsi. Imodoka nshya y'amashanyarazi iraceceka, bityo ibibazo biza nta rusaku. Iminota itanu yo kureba buri gitondo isimbura amatwi wajyaga wiringira.",
    },
    minutes: 45,
    delivery: "both",
    remember: [
      { en: "Daily: tyres, lights, charge level, cabin, any warning light.", rw: "Buri munsi: amapine, amatara, ijanisha ry'umuriro, imbere mu modoka, n'itara ryose ry'iburira." },
      { en: "Weekly: tyre pressure with a gauge, brakes, wipers, washer water, and a proper wash.", rw: "Buri cyumweru: umwuka mu mapine ukoresheje igipimo, amaferi, ama esuiglace, amazi yo koza igirasi, no koza imodoka neza." },
    ],
    lessons: [
      {
        id: "v3l1",
        title: { en: "The five-minute morning walk-around", rw: "Iminota itanu yo kuzenguruka mu gitondo" },
        body: [
          { en: "Walk around the car once. Look at each tyre — is one lower than the others? Check for cuts and nails. Look under the car for any liquid on the ground.", rw: "Zenguruka imodoka rimwe. Reba buri pine — hari irigabanutse kurusha ayandi? Reba niba hari ibyacitse cyangwa imisumari. Reba munsi y'imodoka niba hari amazi ku butaka." },
          { en: "Switch on lights and indicators and confirm they work. Check the windscreen and mirrors are clean — you cannot avoid what you cannot see.", rw: "Coza amatara n'ibimenyetso wemeze ko bikora. Reba ko igirasi n'indorerwamo bisukuye — ntushobora kwirinda icyo utabona." },
          { en: "Inside: check the charge percentage, look for any warning symbol, and confirm the cable is in the boot.", rw: "Imbere: reba ijanisha ry'umuriro, ureba niba hari ikimenyetso cy'iburira, wemeze ko insinga iri mu ikofari." },
        ],
        practice: { en: "Do the walk-around now with a trainer watching. Then teach it to the person next to you.", rw: "Kora uku kuzenguruka nonaha umutoza akureba. Hanyuma ubyigishe uwo muri kumwe." },
        facilitator: { en: "Score it as a practical: each learner performs the walk-around unaided and must name what they are checking for, not just touch parts.", rw: "Bipime nk'igerageza rifatika: buri munyeshuri akore kuzenguruka wenyine kandi avuge icyo ari gushakisha, atari ugukora ku bice gusa." },
      },
      {
        id: "v3l2",
        title: { en: "Tyres and brakes on an EV", rw: "Amapine n'amaferi ku modoka y'amashanyarazi" },
        body: [
          { en: "An EV is heavier than the sedan you know, because of the battery. Tyres wear faster and correct pressure matters more — for safety and for range.", rw: "Imodoka y'amashanyarazi iremereye kurusha iyo uzi, bitewe na bateri. Amapine ashira vuba kandi umwuka ukwiye ni ingenzi cyane — ku mutekano no ku rugendo." },
          { en: "Check pressure weekly when tyres are cold, using the numbers on the door sticker, not a guess from the tyre man.", rw: "Suzuma umwuka buri cyumweru amapine akonje, ukurikije imibare iri ku ikarita y'urugi, atari ugukeka k'usanaga amapine." },
          { en: "Brake pads last longer on an EV because regenerative braking slows the car. But little-used brakes can rust — use the brake pedal firmly sometimes, and have pads inspected at every service.", rw: "Ama plaquette y'amaferi amara igihe kirekire ku modoka y'amashanyarazi kuko regen igabanya umuvuduko. Ariko amaferi adakoreshwa ashobora kwangirika n'ingese — rimwe na rimwe kanda feri cyane, kandi ujye usuzumisha ama plaquette kuri buri isuzuma." },
        ],
        practice: { en: "Find the pressure sticker on the driver's door and write the two numbers in your notebook.", rw: "Shakisha ikarita y'umwuka ku rugi rw'umushoferi wandike imibare yombi mu ikaye yawe." },
      },
      {
        id: "v3l3",
        title: { en: "Service schedule, warranty and records", rw: "Gahunda y'isuzuma, garanti, n'inyandiko" },
        body: [
          { en: "Follow the manufacturer's service intervals even though there is no oil. Services check brakes, coolant, battery health and software.", rw: "Kurikiza ibihe by'isuzuma byatanzwe n'uwakoze imodoka n'ubwo nta mavuta ahari. Isuzuma rireba amaferi, amazi akonjesha, ubuzima bwa bateri, na sisitemu ya mudasobwa." },
          { en: "Skipping approved service can void the battery warranty. The warranty is worth more than the money you save by skipping.", rw: "Gusiba isuzuma ryemewe bishobora kuvanaho garanti ya bateri. Garanti ifite agaciro kurusha amafaranga uzigama usibye isuzuma." },
          { en: "Keep every service paper in one folder, and photograph it on your phone. When you sell, or when the bank asks, that folder is money.", rw: "Bika impapuro zose z'isuzuma mu idosiye imwe, unazifotore kuri telefone. Igihe ugurishije, cyangwa igihe banki ibisabye, iyo dosiye ni amafaranga." },
        ],
        practice: { en: "Create a photo album on your phone called 'CAR PAPERS' and put your first document in it.", rw: "Kora ububiko bw'amafoto kuri telefone bwitwa 'IMPAPURO Z'IMODOKA' ushyiremo inyandiko yawe ya mbere." },
      },
    ],
    quiz: [
      {
        id: "v3q1",
        question: { en: "Why do EV tyres wear faster?", rw: "Kuki amapine y'imodoka y'amashanyarazi ashira vuba?" },
        options: [
          { en: "The car is heavier", rw: "Imodoka iraremereye" },
          { en: "The tyres are cheaper", rw: "Amapine ni ahendutse" },
          { en: "There is no engine", rw: "Nta moteri ihari" },
        ],
        answer: 0,
        explain: { en: "Battery weight plus instant torque wears tyres faster — check pressure weekly.", rw: "Uburemere bwa bateri n'imbaraga ziza ako kanya bishiraho amapine vuba — suzuma umwuka buri cyumweru." },
      },
      {
        id: "v3q2",
        question: { en: "What can happen if you skip approved services?", rw: "Ni iki gishobora kuba nusiba isuzuma ryemewe?" },
        options: [
          { en: "Nothing at all", rw: "Nta kintu na kimwe" },
          { en: "The battery warranty can be lost", rw: "Garanti ya bateri ishobora kuvaho" },
          { en: "The car charges faster", rw: "Imodoka yuzura vuba" },
        ],
        answer: 1,
        explain: { en: "The warranty on the most expensive part depends on documented service.", rw: "Garanti y'igice gihenze cyane iterwa n'isuzuma ryanditse." },
      },
    ],
  },

  {
    id: "v4",
    track: "vehicle",
    code: "V4",
    title: { en: "Driving for range: every kilometre is money", rw: "Gutwara witaye ku rugendo: buri kilometero ni amafaranga" },
    why: {
      en: "Two drivers with the same car can differ by 25% in energy used. That difference is pure profit — or pure loss — every single day.",
      rw: "Abashoferi babiri bafite imodoka imwe bashobora gutandukana ku kigero cya 25% mu ngufu bakoresha. Iryo tandukaniro ni inyungu isesuye — cyangwa igihombo — buri munsi.",
    },
    minutes: 40,
    delivery: "both",
    remember: [
      { en: "Smooth is cheap. Every hard acceleration and hard brake burns money.", rw: "Kugenda utuje ni ugutwara bihendutse. Buri kwihuta cyane no gukanda feri cyane bitwika amafaranga." },
      { en: "Use regenerative braking: lift early, let the car slow itself, and it puts energy back.", rw: "Koresha regen: kura ikirenge hakiri kare, ureke imodoka igabanye umuvuduko yonyine, isubiza ingufu." },
    ],
    lessons: [
      {
        id: "v4l1",
        title: { en: "Regenerative braking, explained simply", rw: "Amaferi asubiza ingufu, mu buryo bworoshye" },
        body: [
          { en: "When you lift your foot off the accelerator, the motor turns into a generator and pushes energy back into the battery while slowing the car.", rw: "Iyo ukuye ikirenge ku pedale y'umuvuduko, moteri ihinduka uruganda rw'amashanyarazi igasubiza ingufu muri bateri mu gihe igabanya umuvuduko w'imodoka." },
          { en: "So the skill is to see the stop early: lift long before the junction, coast, and touch the brake only at the end. On Kigali's hills, going downhill can add percentage back.", rw: "Bityo ubuhanga ni ukubona aho uhagarara hakiri kare: kura ikirenge kera mbere y'isangano, ureke igende, ukande feri gusa ku iherezo. Ku misozi ya Kigali, kumanuka bishobora kongera ijanisha." },
          { en: "This is the opposite of old-car habit, where you accelerated to the light and braked hard. Unlearn that and you gain range for free.", rw: "Ibi ni ibinyuranye n'umuco w'imodoka ishaje, aho wihutaga ukagera ku itara ugakanda feri cyane. Reka uwo muco ubone urugendo ku buntu." },
        ],
        practice: { en: "For one shift, count how many times you brake hard. Try to halve it the next day.", rw: "Mu munsi umwe w'akazi, bara inshuro wakanze feri cyane. Ejo ugerageze kubigabanya kimwe cya kabiri." },
      },
      {
        id: "v4l2",
        title: { en: "Speed, air conditioning and load", rw: "Umuvuduko, ikonjesha, n'imizigo" },
        body: [
          { en: "High speed costs more than anything else. Above roughly 80 km/h the air resistance grows quickly and your kilometres fall.", rw: "Umuvuduko mwinshi uhenda kurusha ikindi cyose. Hejuru ya km 80 ku isaha, umuyaga uhagarika imodoka wiyongera vuba, ibirometero byawe bikagabanuka." },
          { en: "Air conditioning uses real energy, but so does driving with windows open at speed. Cool the car before you leave while it is still plugged in, then keep the AC moderate.", rw: "Ikonjesha rikoresha ingufu nyazo, ariko no gutwara amadirishya afunguye ku muvuduko na byo bikoresha. Konjesha imodoka mbere yo kugenda ikiri ku muriro, hanyuma ukomeze ikonjesha ku rugero." },
          { en: "Weight matters: an unnecessary load in the boot costs range all day. So does under-inflated tyres — check pressure.", rw: "Uburemere ni ingenzi: umuzigo utari ngombwa mu ikofari ugutwara urugendo umunsi wose. N'amapine adafite umwuka uhagije na yo ni uko — suzuma umwuka." },
        ],
        practice: { en: "Record your kWh/100 km today and tomorrow, changing only your speed habit.", rw: "Andika kWh/100 km y'uyu munsi n'iy'ejo, uhindura umuco w'umuvuduko gusa." },
        facilitator: { en: "Run a friendly competition: same route, two drivers, whoever uses less energy wins. Debrief on what they did differently.", rw: "Kora irushanwa ryiza: inzira imwe, abashoferi babiri, ukoresheje ingufu nke atsinda. Muganire ku byo bakoze bitandukanye." },
      },
      {
        id: "v4l3",
        title: { en: "Rain, night and long trips", rw: "Imvura, ijoro, n'ingendo ndende" },
        body: [
          { en: "Rain, wipers, lights and cold air all reduce range slightly. Plan with a margin — never with the last 5%.", rw: "Imvura, ama esuiglace, amatara n'umwuka ukonje bigabanya urugendo gato. Tegura ufite icyizere — ntugategure ushingiye kuri 5% ya nyuma." },
          { en: "On a highway trip, a steady moderate speed beats fast-then-charging. You often arrive at the same time and pay less.", rw: "Ku rugendo rurerure, umuvuduko uhoraho uringaniye uruta kwihuta hanyuma ukazuza. Akenshi ugera igihe kimwe wishyuye bike." },
          { en: "Tell a long-distance client honestly where you will stop to charge. Passengers accept a planned stop; they do not accept a surprise.", rw: "Bwira umukiriya w'urugendo rurerure ukuri aho uzahagarara kuzuza umuriro. Abagenzi bemera guhagarara byateguwe; ntibemera gutungurwa." },
        ],
        practice: { en: "Write your personal minimum: 'I never start a trip below __%.'", rw: "Andika urugero rwawe ntarengwa: 'Sinigera ntangira urugendo nkiri munsi ya __%.'" },
      },
    ],
    quiz: [
      {
        id: "v4q1",
        question: { en: "What is the cheapest way to slow down?", rw: "Ni ubuhe buryo buhendutse bwo kugabanya umuvuduko?" },
        options: [
          { en: "Brake hard at the last moment", rw: "Gukanda feri cyane ku munota wa nyuma" },
          { en: "Lift early and let regeneration slow the car", rw: "Gukura ikirenge hakiri kare ureke regen igabanye umuvuduko" },
          { en: "Switch to neutral", rw: "Gushyira kuri neutre" },
        ],
        answer: 1,
        explain: { en: "Lifting early recovers energy into the battery instead of wasting it as heat.", rw: "Gukura ikirenge hakiri kare bigarura ingufu muri bateri aho kuzita mu bushyuhe." },
      },
      {
        id: "v4q2",
        question: { en: "Which increases energy use the most?", rw: "Ni ikihe kiyongera cyane mu ikoreshwa ry'ingufu?" },
        options: [
          { en: "Driving fast on the highway", rw: "Gutwara byihuse ku muhanda munini" },
          { en: "Using the radio", rw: "Gukoresha radiyo" },
          { en: "Charging at night", rw: "Kuzuza umuriro nijoro" },
        ],
        answer: 0,
        explain: { en: "Air resistance rises sharply with speed — the single biggest range killer.", rw: "Umuyaga uhagarika imodoka wiyongera cyane ku muvuduko — ni cyo cyica urugendo kurusha ibindi." },
      },
    ],
  },

  {
    id: "v5",
    track: "vehicle",
    code: "V5",
    title: { en: "Faults, safety and what never to do yourself", rw: "Ibibazo, umutekano, n'ibyo utagomba na rimwe kwikorera" },
    why: {
      en: "You are used to fixing things yourself, and that skill saved you money for years. On a high-voltage car, some of those same instincts are dangerous. Know the line.",
      rw: "Wamenyereye kwikorera ibisanwa, ubwo buhanga bwakuzigamiye amafaranga imyaka myinshi. Ku modoka ifite amashanyarazi menshi, bimwe muri ibyo byakumenyereye ni akaga. Menya umurongo ntarengwa.",
    },
    minutes: 45,
    delivery: "both",
    remember: [
      { en: "Orange cables = high voltage. Never open, cut, or touch them. Ever.", rw: "Insinga z'umuhondo-orange = amashanyarazi menshi cyane. Ntukigere uzifungura, uzica, cyangwa uzikoraho. Na rimwe." },
      { en: "After an accident or deep water: do not restart, get everyone out, call the programme number.", rw: "Nyuma y'impanuka cyangwa mu mazi menshi: ntugatangire imodoka, sohora abantu bose, uhamagare nimero ya gahunda." },
    ],
    lessons: [
      {
        id: "v5l1",
        title: { en: "The line between your hands and the technician", rw: "Umurongo hagati y'intoki zawe n'umutekinisiye" },
        body: [
          { en: "You can do: tyre pressure, changing a wheel, wipers, washer fluid, bulbs where accessible, cleaning, checking for damage, and reading warning messages.", rw: "Ushobora gukora: umwuka mu mapine, guhindura ipine, ama esuiglace, amazi yo koza igirasi, ampoule zigerwaho, gusukura, gusuzuma ibyangiritse, no gusoma ubutumwa bw'iburira." },
          { en: "You must not do: anything under an orange cover, anything involving the battery pack, the charging port internals, or the cooling system. These carry voltage that kills, even when the car is off.", rw: "Ntugomba gukora: ikintu cyose kiri munsi y'igipfundikizo cy'umuhondo-orange, ikintu cyose gikoraho kuri bateri nkuru, imbere mu kwakira insinga, cyangwa sisitemu ikonjesha. Bifite amashanyarazi yica, ndetse n'iyo imodoka izimye." },
          { en: "There is no shame in this. The old mechanic skill becomes a new skill: knowing exactly what to report, quickly and precisely.", rw: "Nta soni biteye. Ubuhanga bwa mekanisiye bushaje buhinduka ubushya: kumenya neza icyo utanga raporo, vuba kandi neza." },
        ],
        practice: { en: "Write the emergency and service numbers into your phone now, with clear names.", rw: "Andika nimero z'ubutabazi n'iz'isuzuma kuri telefone nonaha, ufite amazina asobanutse." },
        facilitator: { en: "Show the orange cabling physically with the bonnet open, then close it and state the rule again. Repetition at the car is what sticks.", rw: "Erekana insinga z'umuhondo-orange kapo ifunguye, hanyuma uyifunge wongere uvuge itegeko. Gusubiramo ku modoka ni byo bigumaho." },
      },
      {
        id: "v5l2",
        title: { en: "Reading warnings and reporting well", rw: "Gusoma iburira no gutanga raporo neza" },
        body: [
          { en: "When a warning appears, note four things: what the message says, the battery percentage, what you were doing, and whether the car still drives normally.", rw: "Iyo iburira rigaragaye, andika ibintu bine: icyo ubutumwa buvuga, ijanisha rya bateri, icyo wari ukora, no kumenya niba imodoka igenda neza." },
          { en: "Photograph the dashboard. A photo saves an hour of explanation and helps the technician arrive with the right part.", rw: "Fata ifoto ya tabaro. Ifoto izigama isaha yo gusobanura kandi ifasha umutekinisiye kuza afite igice gikwiye." },
          { en: "Report the same day. A small fault reported early is cheap; the same fault after two weeks of driving is expensive.", rw: "Tanga raporo kuri uwo munsi. Ikibazo gito gitangajwe hakiri kare ni gihendutse; icyo kibazo nyuma y'ibyumweru bibiri utwaye ni gihenze." },
        ],
        practice: { en: "Practise a 20-second report out loud: message, percentage, situation, driveable or not.", rw: "Imenyereze gutanga raporo y'amasegonda 20 mu ijwi riranguruye: ubutumwa, ijanisha, uko byari bimeze, niba igenda cyangwa itagenda." },
      },
      {
        id: "v5l3",
        title: { en: "Safety: water, heat, accidents and passengers", rw: "Umutekano: amazi, ubushyuhe, impanuka, n'abagenzi" },
        body: [
          { en: "Do not drive through deep standing water. Modern EVs handle rain well, but flooded roads can damage sealed systems and are never worth the risk.", rw: "Ntutware unyuze mu mazi ahagaze menshi. Imodoka z'amashanyarazi zihanganira imvura neza, ariko imihanda yuzuye amazi ishobora kwangiza sisitemu, kandi ntibikwiye ingaruka." },
          { en: "After any collision, however small: stop, switch off, get passengers out, do not restart, and call. A damaged battery can be fine now and dangerous in an hour.", rw: "Nyuma y'impanuka iyo ari yo yose, n'iyo yaba nto: hagarara, zimya, sohora abagenzi, ntutangire, uhamagare. Bateri yangiritse ishobora kumera neza ubu ikaba akaga nyuma y'isaha." },
          { en: "Tell passengers two things: the car is silent, so wait for your signal before opening doors; and the cable in the boot is not a toy.", rw: "Bwira abagenzi ibintu bibiri: imodoka iraceceka, bityo bategereze ikimenyetso cyawe mbere yo gufungura inzugi; kandi insinga iri mu ikofari si igikinisho." },
        ],
        practice: { en: "Say the accident procedure from memory: stop, off, out, do not restart, call.", rw: "Vuga uko impanuka ikemurwa ubitse mu mutwe: hagarara, zimya, basohore, ntutangire, hamagara." },
      },
    ],
    quiz: [
      {
        id: "v5q1",
        question: { en: "You see an orange cable under the bonnet. What do you do?", rw: "Ubonye insinga y'umuhondo-orange munsi ya kapo. Ukora iki?" },
        options: [
          { en: "Check it is tight", rw: "Ureba niba ikomeye" },
          { en: "Never touch it — report it", rw: "Ntukigere uyikoraho — tanga raporo" },
          { en: "Wrap it with tape", rw: "Uyipfuke na tepi" },
        ],
        answer: 1,
        explain: { en: "Orange means high voltage. Only trained technicians touch it.", rw: "Umuhondo-orange bisobanura amashanyarazi menshi. Abatekinisiye batojwe ni bo bonyine bayikoraho." },
      },
      {
        id: "v5q2",
        question: { en: "After a small collision, the car still starts. What do you do?", rw: "Nyuma y'impanuka nto, imodoka iracyatangira. Ukora iki?" },
        options: [
          { en: "Keep working, it seems fine", rw: "Ukomeza akazi, isa nk'imeze neza" },
          { en: "Stop, switch off, get passengers out and call", rw: "Hagarara, zimya, sohora abagenzi, uhamagare" },
          { en: "Drive straight to a roadside mechanic", rw: "Ujye ku mumekanisiye wo ku muhanda" },
        ],
        answer: 1,
        explain: { en: "Battery damage may not show immediately; the programme must inspect it.", rw: "Bateri yangiritse ntishobora kwigaragaza ako kanya; gahunda igomba kuyisuzuma." },
      },
    ],
  },
];
