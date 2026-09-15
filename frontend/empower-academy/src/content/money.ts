import type { Module } from "./types";

export const moneyModules: Module[] = [
  {
    id: "m1",
    track: "money",
    code: "M1",
    title: {
      en: "From driver to owner: your car is a business",
      rw: "Kuva ku mushoferi ukagera ku nyir'ubwite: imodoka yawe ni ubucuruzi",
    },
    why: {
      en: "You have driven for years. You already know the roads, the customers, the seasons. What changes now is that the money passing through your hands is your own business money, not somebody else's takings.",
      rw: "Umaze imyaka myinshi utwara. Uzi imihanda, uzi abakiriya, uzi ibihe. Icyahindutse ni uko amafaranga anyura mu ntoki zawe ubu ari ay'ubucuruzi bwawe, atari ay'undi muntu.",
    },
    minutes: 45,
    delivery: "both",
    remember: [
      { en: "A loan is not a gift and not a punishment — it is a tool you already paid to use.", rw: "Inguzanyo si impano kandi si igihano — ni igikoresho wishyuriye gukoresha." },
      { en: "Income is not profit. Profit is what stays after the car, the loan and you are paid.", rw: "Amafaranga winjije si inyungu. Inyungu ni ibisigara imodoka, inguzanyo n'umushahara wawe byishyuwe." },
    ],
    lessons: [
      {
        id: "m1l1",
        title: { en: "What you already know is capital", rw: "Ibyo usanzwe uzi ni umutungo" },
        body: [
          {
            en: "Ten or twenty years on the road is training no school gives. You know which stage is busy at 6am, which passenger will call again, how to keep a car moving when money is short.",
            rw: "Imyaka icumi cyangwa makumyabiri ku muhanda ni amasomo nta shuri ritanga. Uzi aho abagenzi baba ari benshi saa kumi n'ebyiri za mu gitondo, uzi umukiriya uzongera guhamagara, uzi uko imodoka ikomeza kugenda n'ubwo amafaranga aba make.",
          },
          {
            en: "What was missing was not intelligence. It was a system: written numbers, a plan, and a car that belongs to you.",
            rw: "Icyabuze si ubwenge. Ni uburyo bufatika: imibare yanditse, gahunda, n'imodoka iba iyawe.",
          },
          {
            en: "This training adds the system on top of the talent you already have. Nothing here asks you to become someone else.",
            rw: "Aya mahugurwa yongera ubwo buryo ku mpano usanganywe. Nta na kimwe kigusaba kuba undi muntu.",
          },
        ],
        practice: {
          en: "Say out loud (or write) three things you know about this work that a new driver does not know.",
          rw: "Vuga mu ijwi riranguruye (cyangwa wandike) ibintu bitatu uzi kuri aka kazi umushoferi mushya atazi.",
        },
        facilitator: {
          en: "Go around the room. Write answers on the board. This opens the group and sets the tone: they are experts being upgraded, not students being corrected.",
          rw: "Zenguruka mu cyumba. Andika ibisubizo ku kibaho. Ibi bifungura itsinda: ni impuguke ziri kongererwa ubumenyi, si abanyeshuri barikosorwa.",
        },
      },
      {
        id: "m1l2",
        title: { en: "Asset loan or project? The difference", rw: "Inguzanyo y'igikoresho cyangwa umushinga? Itandukaniro" },
        body: [
          {
            en: "If you treat the car as a loan, your only question every morning is: can I pay today's instalment? When the instalment is paid you relax, and whatever remains disappears.",
            rw: "Nutekereza ku modoka nk'inguzanyo gusa, ikibazo cyawe buri gitondo ni kimwe: nishyura ubu bwishyu bw'uyu munsi? Iyo bwishyuwe uraruhuka, ibisigaye bikazimira.",
          },
          {
            en: "If you treat it as a project, the question becomes: what did this project earn me this month, and where is that money now? A project has a plan, records, and a next step.",
            rw: "Nutekereza kuri yo nk'umushinga, ikibazo kiba: uyu mushinga wanyinjirije iki uku kwezi, kandi ayo mafaranga ari he ubu? Umushinga ufite gahunda, inyandiko, n'intambwe ikurikira.",
          },
          {
            en: "Same car, same road, same customers. Different result after three years: one driver finishes the loan with nothing else, the other finishes with savings, a maintenance fund and a plan for a second car.",
            rw: "Imodoka imwe, umuhanda umwe, abakiriya bamwe. Ibisubizo bitandukanye nyuma y'imyaka itatu: umushoferi umwe arangiza inguzanyo nta kindi afite, undi arangiza afite ubwizigame, ingoboka yo gusana, na gahunda y'imodoka ya kabiri.",
          },
        ],
        practice: {
          en: "Finish this sentence for yourself: 'In three years, this car should have given me ______.'",
          rw: "Uzuza iyi nteruro ku giti cyawe: 'Mu myaka itatu, iyi modoka igomba kuba yarampaye ______.'",
        },
      },
      {
        id: "m1l3",
        title: { en: "The owner's four questions", rw: "Ibibazo bine by'umuntu utunze ubucuruzi" },
        body: [
          {
            en: "Every owner of a small business answers four questions every week: How much came in? How much went out? What is left? What is that remainder for?",
            rw: "Buri nyir'ubucuruzi buto asubiza ibibazo bine buri cyumweru: Hinjiye angahe? Hasohotse angahe? Hasigaye angahe? Ayo asigaye ni ay'iki?",
          },
          {
            en: "You cannot answer them from memory. Memory keeps the big fares and forgets the small costs — airtime, car wash, parking, a small repair. Small costs are where the profit leaks.",
            rw: "Ntushobora kubisubiza ukoresheje umutwe gusa. Umutwe wibuka amafaranga menshi ukibagirwa amaduka mato — amakarita, koza imodoka, parikingi, gusanwa gato. Ayo mafaranga mato ni ho inyungu ivira.",
          },
          {
            en: "This is why the app asks for two numbers a day. Two numbers, every day, answer all four questions at the end of the month without effort.",
            rw: "Ni yo mpamvu porogaramu igusaba imibare ibiri ku munsi. Imibare ibiri, buri munsi, isubiza ibyo bibazo byose ku mpera z'ukwezi utabigoranywe.",
          },
        ],
        practice: {
          en: "Try it for yesterday: what came in, and everything that went out. Write both, even if you must estimate.",
          rw: "Bigerageze ku munsi w'ejo: hinjiye angahe, n'ibyasohotse byose. Byandike byombi, n'iyo waba ugereranya.",
        },
      },
    ],
    quiz: [
      {
        id: "m1q1",
        question: { en: "You earned 25,000 RWF today and spent 9,000 RWF on charging, wash and airtime. What did you earn?", rw: "Uyu munsi winjije 25,000 RWF ukoresha 9,000 RWF ku kuzuza umuriro, koza imodoka n'amakarita. Winjije angahe?" },
        options: [
          { en: "25,000 RWF", rw: "25,000 RWF" },
          { en: "16,000 RWF before the loan instalment", rw: "16,000 RWF mbere y'ubwishyu bw'inguzanyo" },
          { en: "9,000 RWF", rw: "9,000 RWF" },
        ],
        answer: 1,
        explain: { en: "25,000 is income. 16,000 is what remains, and the loan instalment still comes out of that.", rw: "25,000 ni amafaranga yinjiye. 16,000 ni asigaye, kandi ubwishyu bw'inguzanyo bugomba gukurwamo." },
      },
      {
        id: "m1q2",
        question: { en: "Why write down small expenses?", rw: "Kuki twandika amafaranga mato yasohotse?" },
        options: [
          { en: "For the bank only", rw: "Ni ukubera banki gusa" },
          { en: "Because small costs are where profit quietly disappears", rw: "Kubera ko amafaranga mato ari ho inyungu ibura buhoro buhoro" },
          { en: "It is not necessary", rw: "Ntabwo ari ngombwa" },
        ],
        answer: 1,
        explain: { en: "Small daily costs add to a large monthly number. Written down, they can be reduced.", rw: "Amafaranga mato ya buri munsi ahurizwa hamwe aba menshi ku kwezi. Yanditse, arashobora kugabanywa." },
      },
    ],
  },

  {
    id: "m2",
    track: "money",
    code: "M2",
    title: { en: "Two numbers a day: recording income and expenses", rw: "Imibare ibiri ku munsi: kwandika amafaranga yinjiye n'ayasohotse" },
    why: {
      en: "A driver who records for 30 days can see, for the first time, exactly what the car earns. That single page is what turns a driver into a person a bank can trust and a business that can grow.",
      rw: "Umushoferi wandika iminsi 30 abona, bwa mbere, neza icyo imodoka yinjiza. Urwo rupapuro rumwe ni rwo ruhindura umushoferi umuntu banki yizera n'ubucuruzi bushobora gukura.",
    },
    minutes: 50,
    delivery: "both",
    remember: [
      { en: "Record the same day. Tomorrow you will not remember.", rw: "Andika kuri uwo munsi. Ejo ntuzaba ukibyibuka." },
      { en: "Profit = income − running costs − loan instalment.", rw: "Inyungu = amafaranga yinjiye − ikiguzi cyo gukora − ubwishyu bw'inguzanyo." },
    ],
    lessons: [
      {
        id: "m2l1",
        title: { en: "What counts as income", rw: "Ibibarwa nk'amafaranga yinjiye" },
        body: [
          { en: "Income is every franc a passenger or client pays you: street trips, calls, contracts, deliveries, airport runs, a company that hires the car for a day.", rw: "Amafaranga yinjiye ni buri faranga umugenzi cyangwa umukiriya aguha: ingendo zo mu muhanda, guhamagarwa, amasezerano, gutwara ibintu, kujya ku kibuga cy'indege, cyangwa ikigo cyakodesheje imodoka umunsi." },
          { en: "Record it as it happens, or at three fixed moments: mid-morning, lunch, and end of shift. Fixed moments beat good intentions.", rw: "Byandike ako kanya, cyangwa mu bihe bitatu bihoraho: mu gitondo cyo hagati, ku manywa, no ku iherezo ry'akazi. Ibihe bihoraho biruta imigambi myiza." },
          { en: "Money received on mobile money is still income. Money you did not touch — a client who owes you — is not income yet. Write it as owed.", rw: "Amafaranga wakiriye kuri telefone na yo ni amafaranga yinjiye. Amafaranga utarabona — umukiriya ukurimo — ntabwo ari yinjiye. Yandike nk'umwenda." },
        ],
        practice: { en: "Set two alarms on your phone: 13:00 and 20:00. Those are your recording times.", rw: "Shyiraho ama alarm abiri kuri telefone: saa saba n'ijoro saa mbiri. Ni yo masaha yo kwandika." },
      },
      {
        id: "m2l2",
        title: { en: "The five expense baskets", rw: "Ibitebo bitanu by'ibyasohotse" },
        body: [
          { en: "1. Energy — charging. 2. Care — wash, tyres, service, small repairs. 3. Compliance — insurance, control technique, association fees, permits. 4. Work costs — airtime, data, parking, food while working. 5. Loan — the instalment.", rw: "1. Ingufu — kuzuza umuriro. 2. Kwita ku modoka — koza, amapine, isuzuma, gusana gato. 3. Amategeko — ubwishingizi, isuzuma rya tekiniki, imisanzu y'ishyirahamwe, uruhushya. 4. Ibiciro by'akazi — amakarita, interineti, parikingi, ifunguro ku kazi. 5. Inguzanyo — ubwishyu." },
          { en: "Keep family money out of these baskets. Household spending is not a car expense — it is paid from your salary, which we set in the next module.", rw: "Ntugashyire amafaranga y'urugo muri ibi bitebo. Ibyo mu rugo si ikiguzi cy'imodoka — biva ku mushahara wawe, tuzashyiraho mu isomo rikurikira." },
          { en: "Mixing the two is the most common reason a good driver fails a good loan.", rw: "Kuvanga ibyo byombi ni yo mpamvu ikunze gutuma umushoferi mwiza atsindwa n'inguzanyo nziza." },
        ],
        practice: { en: "List every expense from last week and put each one in a basket. Which basket is biggest?", rw: "Andika ibyasohotse byose by'icyumweru gishize, ushyire buri kimwe mu gitebo. Ni ikihe gitebo kinini kurusha ibindi?" },
        facilitator: { en: "Use real receipts or a role-play day. Let two drivers argue about which basket a car wash belongs to — the discussion teaches more than the answer.", rw: "Koresha inyemezabwishyu nyazo cyangwa umunsi w'ikinamico. Reka abashoferi babiri bajye impaka ku gitebo koza imodoka kigwamo — impaka zigisha kurusha igisubizo." },
      },
      {
        id: "m2l3",
        title: { en: "Reading your own month", rw: "Gusoma ukwezi kwawe" },
        body: [
          { en: "At month end you get four numbers: total in, total out, instalment, and what is left. Look at 'what is left' first — that is your business.", rw: "Ku mpera z'ukwezi ubona imibare ine: byose byinjiye, byose byasohotse, ubwishyu, n'ibisigaye. Reba mbere 'ibisigaye' — ni bwo bucuruzi bwawe." },
          { en: "Then compare months. A month with more income but less left over means costs grew faster than work. That is a signal, not a failure.", rw: "Hanyuma ugereranye amezi. Ukwezi kwinjije menshi ariko kugasigaza make bivuze ko ibiciro byiyongereye kurusha akazi. Ni ikimenyetso, si ukunanirwa." },
          { en: "Bring this page to your bank officer. A driver with 90 days of records asks for terms; a driver without them accepts whatever he is given.", rw: "Jyana urwo rupapuro ku mukozi wa banki. Umushoferi ufite inyandiko z'iminsi 90 arasaba ibyo ashaka; utazifite yemera ibyo ahawe byose." },
        ],
        practice: { en: "Commit to 30 unbroken days of recording. Mark the finish date on your phone calendar.", rw: "Yemerera kwandika iminsi 30 nta gucikamo. Shyira itariki y'iherezo kuri kalendari ya telefone yawe." },
      },
    ],
    quiz: [
      {
        id: "m2q1",
        question: { en: "Which of these is NOT a car expense?", rw: "Ni ikihe muri ibi KITARI ikiguzi cy'imodoka?" },
        options: [
          { en: "School fees for your child", rw: "Amafaranga y'ishuri ry'umwana wawe" },
          { en: "New tyres", rw: "Amapine mashya" },
          { en: "Insurance", rw: "Ubwishingizi" },
        ],
        answer: 0,
        explain: { en: "Household costs are paid from your salary, kept separate from the business.", rw: "Ibyo mu rugo bivanwa ku mushahara wawe, bitandukanye n'ubucuruzi." },
      },
      {
        id: "m2q2",
        question: { en: "When is the best time to record a trip?", rw: "Ni ryari igihe cyiza cyo kwandika urugendo?" },
        options: [
          { en: "At the end of the month", rw: "Ku mpera z'ukwezi" },
          { en: "The same day", rw: "Kuri uwo munsi" },
          { en: "When the bank asks", rw: "Igihe banki ibisabye" },
        ],
        answer: 1,
        explain: { en: "Same-day records are accurate; memory loses the small numbers.", rw: "Inyandiko zo kuri uwo munsi ni zo nyazo; umutwe wibagirwa imibare mito." },
      },
    ],
  },

  {
    id: "m3",
    track: "money",
    code: "M3",
    title: { en: "The wallet: four envelopes that protect you", rw: "Ikofi: amabahasha ane akurinda" },
    why: {
      en: "Most drivers do not fail because they earn too little. They fail because everything sits in one pocket, and one bad week eats the instalment. Envelopes solve this without a bank visit.",
      rw: "Abashoferi benshi ntibananirwa kubera kwinjiza bike. Bananirwa kubera ko byose biba mu mufuka umwe, maze icyumweru kibi kikarya ubwishyu. Amabahasha bikemura utagiye muri banki.",
    },
    minutes: 45,
    delivery: "both",
    remember: [
      { en: "Set aside the daily loan share FIRST, before any other spending.", rw: "Banza ushyire ku ruhande umugabane w'inguzanyo wa buri munsi MBERE y'ikindi cyose." },
      { en: "Maintenance fund: put aside a small fixed amount daily; a tyre never surprises you again.", rw: "Ingoboka yo gusana: shyira ku ruhande agafaranga gato buri munsi; ipine ntirizongera kugutungura." },
    ],
    lessons: [
      {
        id: "m3l1",
        title: { en: "Envelope 1 and 2: the loan and the car", rw: "Ibahasha ya 1 n'iya 2: inguzanyo n'imodoka" },
        body: [
          { en: "Take your monthly instalment and divide by 26 working days. That is your daily loan share. It leaves your pocket before you buy anything.", rw: "Fata ubwishyu bwa buri kwezi ubugabanye n'iminsi 26 y'akazi. Uwo ni umugabane w'inguzanyo wa buri munsi. Uva mu mufuka mbere yo kugura ikindi cyose." },
          { en: "The second envelope is the car itself: tyres, brakes, service, and the things that only come once or twice a year. A small daily amount here prevents borrowing later.", rw: "Ibahasha ya kabiri ni imodoka ubwayo: amapine, amaferi, isuzuma, n'ibiza rimwe cyangwa kabiri mu mwaka. Agafaranga gato ka buri munsi hano kakurinda kongera kwaka inguzanyo." },
          { en: "These two envelopes are not savings. They are bills that have not arrived yet.", rw: "Aya mabahasha abiri si ubwizigame. Ni imyenda itaragera igihe cyo kwishyurwa." },
        ],
        practice: { en: "Calculate your daily loan share now: monthly instalment ÷ 26.", rw: "Bara umugabane wawe wa buri munsi nonaha: ubwishyu bwa buri kwezi ÷ 26." },
      },
      {
        id: "m3l2",
        title: { en: "Envelope 3 and 4: your salary and the emergency", rw: "Ibahasha ya 3 n'iya 4: umushahara wawe n'ibyihutirwa" },
        body: [
          { en: "Pay yourself a fixed salary — the same amount every week. This is the money that goes home. A fixed salary stops the business from being eaten day by day.", rw: "Ihe umushahara uhoraho — ingano imwe buri cyumweru. Ni yo mafaranga ajya mu rugo. Umushahara uhoraho ubuza ubucuruzi kuribwa buhoro buhoro." },
          { en: "The last envelope is the emergency fund: sickness, an accident, a week without work. Aim for one month of instalments plus one month of household costs.", rw: "Ibahasha ya nyuma ni iy'ibyihutirwa: uburwayi, impanuka, icyumweru nta kazi. Igamije ubwishyu bw'ukwezi kumwe hiyongereyeho ibiciro by'urugo by'ukwezi kumwe." },
          { en: "When the emergency fund is full, the next franc goes to growth: a deposit for a second car, a driver you employ, or an early loan payment.", rw: "Iyo ingoboka y'ibyihutirwa yuzuye, ifaranga rikurikira rijya mu iterambere: ingwate y'imodoka ya kabiri, umushoferi umuha akazi, cyangwa kwishyura inguzanyo hakiri kare.", },
        ],
        practice: { en: "Decide your weekly salary number today, and tell one family member what it is.", rw: "Fata icyemezo cy'umushahara wawe wa buri cyumweru uyu munsi, ubibwire umwe mu bagize umuryango." },
        facilitator: { en: "Hand out four real envelopes and a set of play notes. Let each driver physically split one day's takings. The hands remember what the ears forget.", rw: "Tanga amabahasha ane nyayo n'amanota y'ikinamico. Reka buri mushoferi agabanye amafaranga y'umunsi umwe n'intoki. Intoki zibuka ibyo amatwi yibagirwa." },
      },
      {
        id: "m3l3",
        title: { en: "Cash, mobile money and the temptation gap", rw: "Amafaranga mu ntoki, telefone, n'icyuho cy'ibishuko" },
        body: [
          { en: "Money that is easy to reach is easy to spend. Keep the loan and maintenance envelopes somewhere with friction: a separate mobile money account, a savings group, or a bank account you do not carry.", rw: "Amafaranga yoroshye kugeraho ni yo yoroshye gukoresha. Shyira amabahasha y'inguzanyo n'ayo gusana ahantu hagoye kugeraho: konti ya telefone yihariye, ikimina, cyangwa konti ya banki utagendana." },
          { en: "Ibimina and savings groups work well because other people see you. Use what already works in your community rather than a new system nobody trusts.", rw: "Ibimina n'amatsinda y'ubwizigame bikora neza kuko abandi bakubona. Koresha ibisanzwe bikora mu baturanyi bawe aho gushakisha uburyo bushya nta muntu wizera." },
          { en: "The app shows you the envelopes. Your discipline — plus one person who knows your plan — keeps them full.", rw: "Porogaramu ikwereka amabahasha. Ubwitange bwawe — hiyongereyeho umuntu umwe uzi gahunda yawe — ni byo bituma yuzura." },
        ],
        practice: { en: "Choose where each envelope physically lives. Write it down.", rw: "Hitamo aho buri bahasha izabikwa by'ukuri. Ubyandike." },
      },
    ],
    quiz: [
      {
        id: "m3q1",
        question: { en: "Your instalment is 260,000 RWF a month. What is the daily share over 26 working days?", rw: "Ubwishyu bwawe ni 260,000 RWF ku kwezi. Umugabane wa buri munsi ku minsi 26 y'akazi ni angahe?" },
        options: [
          { en: "5,000 RWF", rw: "5,000 RWF" },
          { en: "10,000 RWF", rw: "10,000 RWF" },
          { en: "26,000 RWF", rw: "26,000 RWF" },
        ],
        answer: 1,
        explain: { en: "260,000 ÷ 26 = 10,000 RWF set aside every working day.", rw: "260,000 ÷ 26 = 10,000 RWF ushyira ku ruhande buri munsi w'akazi." },
      },
      {
        id: "m3q2",
        question: { en: "What is the emergency fund for?", rw: "Ingoboka y'ibyihutirwa ni iy'iki?" },
        options: [
          { en: "A new phone", rw: "Telefone nshya" },
          { en: "Sickness, accident, or a week without work", rw: "Uburwayi, impanuka, cyangwa icyumweru nta kazi" },
          { en: "Fuel", rw: "Lisansi" },
        ],
        answer: 1,
        explain: { en: "It protects the instalment when life interrupts work.", rw: "Irinda ubwishyu igihe ubuzima buhagaritse akazi." },
      },
    ],
  },

  {
    id: "m4",
    track: "money",
    code: "M4",
    title: { en: "Understanding your loan — and servicing it on time", rw: "Gusobanukirwa inguzanyo yawe — no kuyishyura ku gihe" },
    why: {
      en: "The bank is not an enemy and not a father. It is a partner with rules. A driver who understands the rules pays less, sleeps better, and gets a bigger second loan.",
      rw: "Banki si umwanzi kandi si se w'umuntu. Ni umufatanyabikorwa ufite amategeko. Umushoferi wumva ayo mategeko yishyura bike, arasinzira neza, kandi azabona inguzanyo ya kabiri nini.",
    },
    minutes: 60,
    delivery: "classroom",
    remember: [
      { en: "Interest is charged on the balance you still owe — pay early and the balance, and the interest, both fall.", rw: "Inyungu ibarwa ku mwenda usigaye — wishyura hakiri kare, umwenda n'inyungu bigabanuka byombi." },
      { en: "A clean repayment record is an asset. It buys your next loan at a better rate.", rw: "Amateka meza yo kwishyura ni umutungo. Aguha inguzanyo ikurikira ku giciro cyiza." },
    ],
    lessons: [
      {
        id: "m4l1",
        title: { en: "What the bank is actually looking at", rw: "Icyo banki ireba mu by'ukuri" },
        body: [
          { en: "Three things: can this person earn enough (capacity), will this person pay (character and record), and what happens if they stop (collateral).", rw: "Ibintu bitatu: uyu muntu ashobora kwinjiza bihagije (ubushobozi), uyu muntu azishyura (imyifatire n'amateka), n'ibiba nk'ahagaze (ingwate)." },
          { en: "Your daily records answer the first. Your repayment history answers the second. The vehicle and the programme answer the third.", rw: "Inyandiko zawe za buri munsi zisubiza icya mbere. Amateka yo kwishyura asubiza icya kabiri. Imodoka na gahunda bisubiza icya gatatu." },
          { en: "This is why recording is not paperwork for its own sake. It is the evidence that makes you fundable.", rw: "Ni yo mpamvu kwandika atari impapuro z'ubusa. Ni gihamya ituma ushobora guhabwa inguzanyo." },
        ],
        practice: { en: "Prepare three questions you want to ask the bank officer at the classroom session.", rw: "Tegura ibibazo bitatu ushaka kubaza umukozi wa banki mu masomo yo mu cyumba." },
        facilitator: {
          en: "This lesson is the bank partner's slot (30–40 min): their product, the rate, fees, insurance, grace period, what triggers penalties, and how early repayment is handled. Ask them to end with a live example on a whiteboard, not slides.",
          rw: "Iri somo ni umwanya w'umufatanyabikorwa wa banki (iminota 30–40): igicuruzwa cyabo, inyungu, amafaranga y'inyongera, ubwishingizi, igihe cyo kuruhuka, ibitera ibihano, n'uko kwishyura hakiri kare bifatwa. Basabe kurangiza batanga urugero nyakuri ku kibaho, atari kuri ekran.",
        },
      },
      {
        id: "m4l2",
        title: { en: "Reducing balance, in plain words", rw: "Umwenda ugabanuka, mu magambo yoroshye" },
        body: [
          { en: "Interest is calculated on what you still owe, not on the original amount. Every payment cuts the balance, so the next month's interest is smaller.", rw: "Inyungu ibarwa ku byo ukirimo, atari ku mafaranga wahawe mbere. Buri bwishyu bugabanya umwenda, bityo inyungu y'ukwezi gutaha ikagabanuka." },
          { en: "That means an extra payment is worth more than it looks. Paying a little more, early in the loan, removes months of interest at the end.", rw: "Bivuze ko ubwishyu bw'inyongera bufite agaciro kurusha uko bugaragara. Kwishyura gato birenzeho, hakiri kare, bikuraho amezi y'inyungu ku iherezo." },
          { en: "Late payment does the opposite: penalties are added, the balance grows, and your record is marked. One month of carelessness can cost you a year of good terms.", rw: "Gutinda kwishyura bikora ibinyuranye: hiyongeraho ibihano, umwenda ukiyongera, kandi amateka yawe akandikwaho. Ukwezi kumwe kw'uburangare gushobora kugutwara umwaka w'amasezerano meza." },
        ],
        practice: { en: "Ask your bank: what happens if I pay 20,000 RWF extra every month? Write the answer.", rw: "Baza banki yawe: bigenda bite nishyuye 20,000 RWF y'inyongera buri kwezi? Andika igisubizo." },
      },
      {
        id: "m4l3",
        title: { en: "Trouble: speak early, not late", rw: "Ikibazo: vuga hakiri kare, atari bwangu" },
        body: [
          { en: "Accidents, illness, a slow season — banks have seen all of it. What they cannot handle is silence.", rw: "Impanuka, uburwayi, igihe cy'akazi gake — banki zabibonye byose. Icyo zidashobora kwihanganira ni ukuceceka." },
          { en: "If you will be short, call before the due date. Ask about restructuring, a short grace, or a partial payment. Early conversation keeps your record clean.", rw: "Nubona uzabura, hamagara mbere y'itariki yo kwishyura. Baza ku ivugururwa ry'amasezerano, akaruhuko gato, cyangwa kwishyura igice. Kuvugana hakiri kare bituma amateka yawe akomeza kuba meza." },
          { en: "Never borrow at high daily interest to pay a bank instalment. That is the fastest way to lose the car.", rw: "Ntukigere waka inguzanyo y'inyungu nyinshi ya buri munsi ngo wishyure banki. Ni bwo buryo bwihuse bwo gutakaza imodoka." },
        ],
        practice: { en: "Save your loan officer's number in your phone under 'BANK — call early'.", rw: "Bika nimero y'umukozi wa banki kuri telefone wandike 'BANKI — hamagara hakiri kare'." },
      },
    ],
    quiz: [
      {
        id: "m4q1",
        question: { en: "On a reducing balance loan, when does an extra payment help most?", rw: "Ku nguzanyo igabanuka, ubwishyu bw'inyongera bufasha kurushaho ryari?" },
        options: [
          { en: "Early in the loan", rw: "Hakiri kare mu nguzanyo" },
          { en: "In the last month", rw: "Mu kwezi kwa nyuma" },
          { en: "It makes no difference", rw: "Nta tandukaniro bitera" },
        ],
        answer: 0,
        explain: { en: "Cutting the balance early removes interest from every month that follows.", rw: "Kugabanya umwenda hakiri kare bikuraho inyungu ku mezi yose akurikira." },
      },
      {
        id: "m4q2",
        question: { en: "You know next month's instalment will be short. What do you do?", rw: "Uzi ko ubwishyu bw'ukwezi gutaha buzabura. Ukora iki?" },
        options: [
          { en: "Wait and see", rw: "Utegereze urebe" },
          { en: "Call the bank before the due date", rw: "Hamagara banki mbere y'itariki yo kwishyura" },
          { en: "Borrow from a daily-interest lender", rw: "Guza ku muntu utanga inguzanyo y'inyungu ya buri munsi" },
        ],
        answer: 1,
        explain: { en: "Early contact protects your record and opens options.", rw: "Kuvugana hakiri kare birinda amateka yawe kandi bigufungurira amahitamo." },
      },
    ],
  },

  {
    id: "m5",
    track: "money",
    code: "M5",
    title: { en: "Your one-page business plan", rw: "Gahunda y'ubucuruzi bwawe ku rupapuro rumwe" },
    why: {
      en: "A business plan is not a thick document for offices. It is one page that answers: what I do, who pays me, what it costs, what I keep, and what comes next. You can write it in your own words.",
      rw: "Gahunda y'ubucuruzi si igitabo kinini cy'ibiro. Ni urupapuro rumwe rusubiza: icyo nkora, unyishyura, ikinsaba, ibyo nsigarana, n'ibikurikira. Ushobora kuyandika mu magambo yawe.",
    },
    minutes: 60,
    delivery: "both",
    remember: [
      { en: "Five parts: work, customers, costs, profit, next step.", rw: "Ibice bitanu: akazi, abakiriya, ibiciro, inyungu, intambwe ikurikira." },
      { en: "A plan written in Kinyarwanda in your own hand counts. Perfection is not required.", rw: "Gahunda wanditse mu Kinyarwanda n'ukuboko kwawe irahagije. Ntibisaba kuba byuzuye rwose." },
    ],
    lessons: [
      {
        id: "m5l1",
        title: { en: "Part 1–3: work, customers, costs", rw: "Igice cya 1–3: akazi, abakiriya, ibiciro" },
        body: [
          { en: "Work: what exactly does the car do? City trips only, or contracts, deliveries, school runs, airport, weekend hires? Different work has different money.", rw: "Akazi: imodoka ikora iki neza? Ingendo zo mu mujyi gusa, cyangwa amasezerano, gutwara ibintu, gutwara abanyeshuri, ikibuga cy'indege, gukodeshwa mu mpera z'icyumweru? Akazi gatandukanye kinjiza amafaranga atandukanye." },
          { en: "Customers: name them. 'People' is not a customer. 'Three offices in Nyarutarama that need morning pickups' is a customer.", rw: "Abakiriya: bavuge amazina. 'Abantu' si umukiriya. 'Ibiro bitatu i Nyarutarama bikeneye gutwarwa mu gitondo' ni umukiriya." },
          { en: "Costs: use your 30 days of records. Real numbers, not guesses. This is where your recording work pays off.", rw: "Ibiciro: koresha inyandiko zawe z'iminsi 30. Imibare nyayo, atari ugukeka. Ni ho akazi ko kwandika kagira icyo kamaze." },
        ],
        practice: { en: "Write three sentences: what my car does, who my three best customers are, what my month costs.", rw: "Andika interuro eshatu: icyo imodoka yanjye ikora, abakiriya banjye batatu beza, n'ibyo ukwezi kunsaba." },
      },
      {
        id: "m5l2",
        title: { en: "Part 4–5: profit and the next step", rw: "Igice cya 4–5: inyungu n'intambwe ikurikira" },
        body: [
          { en: "Profit: income minus costs minus instalment. Write the real number even if it is small. Small and true beats big and imagined.", rw: "Inyungu: amafaranga yinjiye ukuyemo ibiciro n'ubwishyu. Andika umubare nyawo n'ubwo waba muto. Muto ariko nyawo aruta munini w'ibitekerezo." },
          { en: "Next step: what would make this number bigger? A steady contract, night shifts, a partner driver, a cheaper charging routine, or a second vehicle after this loan closes.", rw: "Intambwe ikurikira: ni iki cyatuma uyu mubare wiyongera? Amasezerano ahoraho, gukora nijoro, umushoferi mugenzi, uburyo buhendutse bwo kuzuza umuriro, cyangwa imodoka ya kabiri iyi nguzanyo irangiye." },
          { en: "Pick one next step, not five. One step done beats five steps discussed.", rw: "Hitamo intambwe imwe, atari eshanu. Intambwe imwe yakozwe iruta eshanu zaganiriweho." },
        ],
        practice: { en: "Choose your one next step and a date to start it.", rw: "Hitamo intambwe yawe imwe n'itariki uzayitangiriraho." },
        facilitator: { en: "Pair drivers. Each presents his page to the other in two minutes; the listener asks only one question: 'where will that money come from?'", rw: "Fatanya abashoferi babiri babiri. Buri wese asobanurira mugenzi we urupapuro rwe mu minota ibiri; uwumva abaza ikibazo kimwe gusa: 'ayo mafaranga azava he?'" },
      },
      {
        id: "m5l3",
        title: { en: "Growing beyond one car", rw: "Gukura urenga imodoka imwe" },
        body: [
          { en: "The drivers who grow do the same three things: they keep records, they finish the first loan cleanly, and they reinvest instead of upgrading their lifestyle first.", rw: "Abashoferi bateye imbere bakora bimwe bitatu: bandika, barangiza inguzanyo ya mbere neza, kandi bongera gushora aho guhindura imibereho mbere y'igihe." },
          { en: "Options after loan one: a second EV with a hired driver, joining or forming a cooperative to win contracts, or a charging-and-service point serving other drivers.", rw: "Amahitamo nyuma y'inguzanyo ya mbere: imodoka ya kabiri ifite umushoferi wahawe akazi, kwinjira cyangwa gushinga koperative kugira ngo mubone amasezerano, cyangwa ikigo cyo kuzuza umuriro no gusana gifasha abandi bashoferi." },
          { en: "A hired driver needs the same system you learned here — records, envelopes, weekly review. Do not hand someone a car without a system.", rw: "Umushoferi umuhaye akazi akeneye uburyo bumwe wize hano — inyandiko, amabahasha, isuzuma rya buri cyumweru. Ntugahe umuntu imodoka nta buryo." },
        ],
        practice: { en: "Write the date your loan ends, and one sentence about what you want on that day.", rw: "Andika itariki inguzanyo yawe irangiraho, n'interuro imwe ku cyo uzaba ushaka kuri uwo munsi." },
      },
    ],
    quiz: [
      {
        id: "m5q1",
        question: { en: "Which is a real customer description?", rw: "Ni ikihe gisobanuro nyacyo cy'umukiriya?" },
        options: [
          { en: "Everybody in Kigali", rw: "Buri wese i Kigali" },
          { en: "Three offices in Nyarutarama needing morning pickups", rw: "Ibiro bitatu i Nyarutarama bikeneye gutwarwa mu gitondo" },
          { en: "Anyone with money", rw: "Umuntu wese ufite amafaranga" },
        ],
        answer: 1,
        explain: { en: "Named, specific customers can be served, counted and kept.", rw: "Abakiriya bazwi neza barashobora gukorerwa, kubarwa no kugumana." },
      },
      {
        id: "m5q2",
        question: { en: "After finishing the first loan, what do growing drivers do first?", rw: "Barangije inguzanyo ya mbere, abashoferi bateye imbere babanza iki?" },
        options: [
          { en: "Reinvest in the business", rw: "Bongera gushora mu bucuruzi" },
          { en: "Change their lifestyle", rw: "Bahindura imibereho" },
          { en: "Stop recording", rw: "Bahagarika kwandika" },
        ],
        answer: 0,
        explain: { en: "Reinvestment is what turns one car into an enterprise.", rw: "Kongera gushora ni byo bihindura imodoka imwe ikigo cy'ubucuruzi." },
      },
    ],
  },
];
