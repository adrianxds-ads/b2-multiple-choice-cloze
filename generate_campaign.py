import json, re
from pathlib import Path
OUT=Path(r"C:\Users\adria\Documents\GitHub\b2-multiple-choice-cloze")
V={
"agent":["The hotel","The museum","The airline","The school","The company","The council","The office","The centre","The department","The agency","The team","The committee","The college","The clinic","The theatre","The library","The restaurant","The tour operator","The visitor centre","The research group","The booking team","The events team","The support team","The local authority"],
"person":["Marta","Daniel","Sara","Tom","Nina","Leo","Clara","Alex","Emma","Hugo","Lucy","Marc","Nora","Ben","Mia","Liam","Eva","Noah","Iris","Luke","Amy","Eric","Lea","Sam"],
"thing":["the report","the booking","the application","the form","the email","the project","the plan","the proposal","the document","the survey","the ticket","the reservation","the complaint","the request","the schedule","the contract","the message","the invoice","the presentation","the course","the meeting","the event","the website","the brochure"],
"topic":["the new schedule","the final report","the visitor survey","the booking system","the training course","the travel plan","the museum project","the hotel policy","the customer complaint","the safety rules","the event programme","the marketing plan","the online form","the flight change","the class project","the job application","the local campaign","the new website","the research results","the tour route","the staff meeting","the budget proposal","the service update","the exam timetable"],
"place":["the city centre","the airport","the station","the hotel","the museum","the office","the classroom","the library","the visitor centre","the theatre","the restaurant","the college","the clinic","the conference centre","the beach","the old town","the exhibition","the market","the harbour","the park","the campus","the terminal","the town hall","the gallery"],
"time":["today","this week","tomorrow","before Friday","next month","this morning","after lunch","before the meeting","during the course","this afternoon","next Monday","before the deadline","at the weekend","later today","before six","after the exam","this evening","next week","before the trip","during the project","before opening","after the tour","before class","at the end of the day"],
"activity":["working abroad","studying online","travelling alone","speaking in public","meeting visitors","using the new system","working under pressure","learning vocabulary","planning events","dealing with complaints","booking flights","writing reports","working in teams","using public transport","organising tours","handling bookings","answering emails","preparing presentations","helping customers","studying at night","working weekends","learning languages","managing projects","giving directions"],
"object":["the suitcase","the box","the equipment","the bag","the package","the chair","the screen","the table","the sign","the door","the parcel","the case","the folder","the camera","the printer","the lamp","the bicycle","the trolley","the suitcase","the display","the barrier","the notice","the shelf","the luggage"],
"area":["English","customer service","tourism","project work","exam practice","writing","speaking","research","planning","teamwork","technology","local history","visitor care","booking skills","presentation skills","grammar","vocabulary","communication","time management","digital skills","report writing","travel planning","event management","public speaking"],
"number":["two","three","four","five","six","seven","eight","nine","ten","twelve","fifteen","twenty","twenty-five","thirty","forty","fifty","sixty","seventy","eighty","ninety","one hundred","two hundred","three hundred","five hundred"]
}
V["bookable"]=["a room","the tickets","a table","a guided tour","a flight","a hotel room","the excursion","a seat","the museum tickets","the train tickets","a transfer","the accommodation","a city tour","the entrance tickets","a meeting room","a rental car","the return flight","a restaurant table","the airport transfer","a walking tour","a coach ticket","the theatre seats","a hostel room","the ferry tickets"]
V["effectarea"]=["your concentration","your performance","your memory","your mood","your sleep","your confidence","your attention","your reaction time","your decision-making","your energy","your motivation","your productivity","your pronunciation","your fluency","your accuracy","your results","your work","your studies","your health","your routine","your focus","your progress","your judgement","your learning"]
DOMAINS=["work","travel","study","tourism","services","daily"]
def B(q,a,c,rule,trigger,keys=("agent",)): return {"q":q,"a":a,"c":c,"rule":rule,"trigger":trigger,"keys":keys}
SKILLS={}
SKILLS["articles"]=("Articles · a/an/the/Ø",[
B("{agent} has ___ excellent reputation for service.",["an","a","the","—"],0,"Use an before a singular noun phrase beginning with a vowel sound.","A/AN/THE/Ø",("agent",)),
B("{agent} is close to ___ airport.",["an","a","the","—"],0,"Use an with a singular countable noun beginning with a vowel sound when it is not specific.","A/AN/THE/Ø",("agent",)),
B("{person} plays ___ guitar in a local group.",["the","a","an","—"],0,"Use the with musical instruments in this general pattern.","THE + MUSICAL INSTRUMENT",("person",)),
B("{person} usually has ___ breakfast before work.",["—","the","a","an"],0,"Meals normally take no article when used generally.","Ø + MEALS",("person",)),
B("{agent} is ___ largest one in the area.",["the","a","an","—"],0,"Superlatives normally take the.","THE + SUPERLATIVE",("agent",))])
SKILLS["quantifiers"]=("Quantifiers · much/many/few/little",[
B("There aren't ___ seats left at {place}.",["many","much","little","a little"],0,"Use many with plural countable nouns.","MANY + COUNTABLE PLURAL",("place",)),
B("We have very ___ time before {time}.",["little","few","many","a few"],0,"Use little with uncountable nouns such as time.","LITTLE + UNCOUNTABLE",("time",)),
B("Only a ___ people understood {topic}.",["few","little","much","amount"],0,"Use a few with plural countable nouns.","A FEW + COUNTABLE PLURAL",("topic",)),
B("A large ___ of visitors use {place}.",["number","amount","quantity","level"],0,"Use number of with plural countable nouns.","NUMBER OF + PLURAL",("place",)),
B("We received a small ___ of information about {topic}.",["amount","number","count","total"],0,"Use amount of with uncountable nouns.","AMOUNT OF + UNCOUNTABLE",("topic",))])
SKILLS["verb_prepositions"]=("Verb + preposition",[
B("{person} relies ___ public transport to get to {place}.",["on","in","at","for"],0,"Rely is followed by on.","RELY ON",("person","place")),
B("{person} insisted ___ checking {thing}.",["on","in","at","for"],0,"Insist is followed by on + -ing.","INSIST ON + -ING",("person","thing")),
B("{person} succeeded ___ completing {thing}.",["in","on","at","with"],0,"Succeed is followed by in + -ing.","SUCCEED IN + -ING",("person","thing")),
B("{person} recovered ___ the problem quickly.",["from","of","with","after"],0,"Recover is followed by from.","RECOVER FROM",("person",)),
B("How does {person} cope ___ {activity}?",["with","to","for","against"],0,"Cope is followed by with.","COPE WITH",("person","activity"))])
SKILLS["adjective_prepositions"]=("Adjective + preposition",[
B("{person} is responsible ___ {thing}.",["for","of","to","with"],0,"Responsible is followed by for.","RESPONSIBLE FOR",("person","thing")),
B("{person} is capable ___ {activity}.",["of","to","for","with"],0,"Capable is followed by of + noun/-ing.","CAPABLE OF",("person","activity")),
B("{person} is familiar ___ {topic}.",["with","to","of","about"],0,"Familiar is followed by with.","FAMILIAR WITH",("person","topic")),
B("{person} wasn't aware ___ {topic}.",["of","about","for","to"],0,"Aware is followed by of.","AWARE OF",("person","topic")),
B("{person} is interested ___ {activity}.",["in","on","at","for"],0,"Interested is followed by in.","INTERESTED IN",("person","activity"))])
SKILLS["verb_ing"]=("Verb patterns · -ing",[
B("{person} tries to avoid ___ mistakes in {area}.",["making","to make","make","made"],0,"Avoid is followed by -ing.","AVOID + -ING",("person","area")),
B("{person} suggested ___ a taxi to {place}.",["taking","to take","take","took"],0,"Suggest is followed by -ing when no object + should-clause is used.","SUGGEST + -ING",("person","place")),
B("{person} is considering ___ for a new course.",["applying","to apply","apply","applied"],0,"Consider is followed by -ing.","CONSIDER + -ING",("person",)),
B("{person} admitted ___ the rule.",["breaking","to break","break","broke"],0,"Admit is followed by -ing.","ADMIT + -ING",("person",)),
B("{person} denied ___ the document.",["taking","to take","take","took"],0,"Deny is followed by -ing.","DENY + -ING",("person",))])
SKILLS["verb_to"]=("Verb patterns · to-infinitive",[
B("{person} managed ___ {thing} on time.",["to finish","finishing","finish","to finishing"],0,"Manage is followed by to-infinitive.","MANAGE TO + VERB",("person","thing")),
B("{person} refused ___ {thing}.",["to sign","signing","sign","to signing"],0,"Refuse is followed by to-infinitive.","REFUSE TO + VERB",("person","thing")),
B("{person} can't afford ___ a new ticket.",["to buy","buying","buy","to buying"],0,"Afford is followed by to-infinitive.","AFFORD TO + VERB",("person",)),
B("{person} decided ___ {place} early.",["to leave","leaving","leave","left"],0,"Decide is followed by to-infinitive.","DECIDE TO + VERB",("person","place")),
B("{person} hopes ___ {topic} soon.",["to discuss","discussing","discuss","discussed"],0,"Hope is followed by to-infinitive.","HOPE TO + VERB",("person","topic"))])
SKILLS["bare_infinitive"]=("Infinitive without to",[
B("The manager let {person} ___ early.",["leave","to leave","leaving","left"],0,"Let + object takes the infinitive without to.","LET + OBJECT + VERB",("person",)),
B("The delay made {person} ___ outside.",["wait","to wait","waiting","waited"],0,"Make + object takes the infinitive without to in the active voice.","MAKE + OBJECT + VERB",("person",)),
B("{person} had better ___ {thing} again.",["check","to check","checking","checked"],0,"Had better is followed by the infinitive without to.","HAD BETTER + VERB",("person","thing")),
B("{person} would rather ___ at {place}.",["stay","to stay","staying","stayed"],0,"Would rather with the same subject takes the infinitive without to.","WOULD RATHER + VERB",("person","place")),
B("Why not ___ {topic} before deciding?",["discuss","to discuss","discussing","discussed"],0,"Why not is followed by the infinitive without to.","WHY NOT + VERB",("topic",))])
SKILLS["phrasal_get_take"]=("Phrasal verbs · get/take",[
B("It took {person} weeks to ___ the disappointment.",["get over","get by","get back","get off"],0,"Get over means recover from a difficult experience.","GET OVER",("person",)),
B("{person} can ___ on a small budget.",["get by","get over","get out","get through with"],0,"Get by means manage with what is available.","GET BY",("person",)),
B("A larger company may ___ {agent}.",["take over","take up","take off","take out"],0,"Take over means gain control of an organisation.","TAKE OVER",("agent",)),
B("{person} decided to ___ photography as a hobby.",["take up","take on","take over","take off"],0,"Take up means start a new activity.","TAKE UP",("person",)),
B("{person} doesn't want to ___ more work {time}.",["take on","take up","take over","take off"],0,"Take on means accept work or responsibility.","TAKE ON",("person","time"))])
SKILLS["phrasal_put_set"]=("Phrasal verbs · put/set",[
B("Don't ___ {thing} until the last minute.",["put off","put out","put away","put down"],0,"Put off means postpone.","PUT OFF",("thing",)),
B("{person} can't ___ the noise at {place}.",["put up with","put out","put over","put through"],0,"Put up with means tolerate.","PUT UP WITH",("person","place")),
B("{person} plans to ___ a new business.",["set up","set off","set out","set down"],0,"Set up means establish or create.","SET UP",("person",)),
B("We should ___ for {place} before eight.",["set off","set up","set out of","set down"],0,"Set off means start a journey.","SET OFF",("place",)),
B("{person} immediately ___ solving the problem.",["set about","set off","set up","set aside"],0,"Set about means begin doing something in a determined way.","SET ABOUT + -ING",("person",))])
SKILLS["phrasal_look_come"]=("Phrasal verbs · look/come",[
B("{agent} promised to ___ {topic}.",["look into","look after","look over to","look for into"],0,"Look into means investigate.","LOOK INTO",("agent","topic")),
B("{person} has to ___ the children {time}.",["look after","look into","look over","look up to"],0,"Look after means take care of.","LOOK AFTER",("person","time")),
B("{person} is looking forward to ___ {place}.",["visiting","visit","to visit","visited"],0,"Look forward to is followed by -ing because to is a preposition.","LOOK FORWARD TO + -ING",("person","place")),
B("{person} came ___ an old photo in {place}.",["across","over","through","by"],0,"Come across means find by chance.","COME ACROSS",("person","place")),
B("We need to come ___ with a better solution to {topic}.",["up","out","over","through"],0,"Come up with means think of an idea or solution.","COME UP WITH",("topic",))])
SKILLS["phrasal_general"]=("Phrasal verbs · general",[
B("{agent} had to ___ the event because of the weather.",["call off","call out","call up","call in"],0,"Call off means cancel.","CALL OFF",("agent",)),
B("{agent} will ___ further tests on {topic}.",["carry out","carry on","carry off","carry over"],0,"Carry out means perform or conduct.","CARRY OUT",("agent","topic")),
B("{person} wants to ___ what happened to {thing}.",["find out","find up","find over","find off"],0,"Find out means discover information.","FIND OUT",("person","thing")),
B("We may ___ water before reaching {place}.",["run out of","run away from","run off with","run down on"],0,"Run out of means use all of something.","RUN OUT OF",("place",)),
B("{thing} turned ___ to be more useful than expected.",["out","up","over","off"],0,"Turn out means prove to be.","TURN OUT",("thing",))])
SKILLS["colloc_make_do"]=("Collocations · make/do",[
B("{agent} needs to ___ a decision about {topic}.",["make","do","take","have"],0,"The collocation is make a decision.","MAKE A DECISION",("agent","topic")),
B("{person} has made good ___ in {area}.",["progress","advance","movement","development"],0,"The fixed collocation is make progress.","MAKE PROGRESS",("person","area")),
B("{agent} is doing ___ on {topic}.",["research","an investigation of","a study to","information"],0,"The standard collocation is do research.","DO RESEARCH",("agent","topic")),
B("The storm did serious ___ to {place}.",["damage","harmful","break","effect"],0,"The collocation is do damage.","DO DAMAGE",("place",)),
B("{agent} does a lot of ___ with local companies.",["business","workings","trade work","deal"],0,"The collocation is do business with.","DO BUSINESS",("agent",))])
SKILLS["colloc_take_have"]=("Collocations · take/have",[
B("{person} should ___ advantage of the free course.",["take","have","make","do"],0,"The expression is take advantage of.","TAKE ADVANTAGE OF",("person",)),
B("{person} plans to ___ part in the event.",["take","have","make","do"],0,"The expression is take part in.","TAKE PART IN",("person",)),
B("The meeting will ___ place at {place}.",["take","have","make","do"],0,"The expression is take place.","TAKE PLACE",("place",)),
B("{person} had difficulty ___ {thing}.",["understanding","to understand","understand","understood"],0,"Have difficulty is followed by -ing.","HAVE DIFFICULTY + -ING",("person","thing")),
B("{topic} may have an ___ on the final decision.",["effect","affect","impacting","result to"],0,"Have an effect on is a standard collocation.","HAVE AN EFFECT ON",("topic",))])
SKILLS["colloc_verb_noun"]=("Collocations · verb + noun",[
B("{agent} wants to ___ awareness of {topic}.",["raise","rise","lift","grow"],0,"The collocation is raise awareness.","RAISE AWARENESS",("agent","topic")),
B("The two sides finally ___ an agreement on {topic}.",["reached","arrived","achieved","met"],0,"The collocation is reach an agreement.","REACH AN AGREEMENT",("topic",)),
B("{thing} failed to ___ our expectations.",["meet","reach","fill","complete"],0,"The collocation is meet expectations.","MEET EXPECTATIONS",("thing",)),
B("The report ___ attention to {topic}.",["draws","pulls","takes","brings"],0,"The collocation is draw attention to.","DRAW ATTENTION TO",("topic",)),
B("{person} gained valuable ___ through {activity}.",["experience","practice","knowledge","skill"],0,"The collocation is gain experience.","GAIN EXPERIENCE",("person","activity"))])
SKILLS["colloc_adverb"]=("Adverb + adjective collocations",[
B("{person} is deeply ___ about {topic}.",["concerned","worriedly","serious","careful"],0,"Deeply concerned is a common collocation.","DEEPLY CONCERNED",("person","topic")),
B("{thing} is widely ___ online.",["available","possible","openly","free"],0,"Widely available is a common collocation.","WIDELY AVAILABLE",("thing",)),
B("{topic} is closely ___ to the main issue.",["related","joined","near","attached"],0,"Closely related is the natural collocation.","CLOSELY RELATED",("topic",)),
B("Booking early is strongly ___ for visits to {place}.",["recommended","advised to","suggested to","preferred"],0,"Strongly recommended is a standard collocation.","STRONGLY RECOMMENDED",("place",)),
B("{person} was highly ___ with the service.",["satisfied","pleasing","gladly","contented by"],0,"Highly satisfied is a standard collocation.","HIGHLY SATISFIED",("person",))])
SKILLS["fixed_in"]=("Fixed expressions · in",[
B("Please book {bookable} in ___.",["advance","front","before","ahead"],0,"The fixed expression is in advance.","IN ADVANCE",("bookable",)),
B("{person} is in ___ of {thing}.",["charge","control","care","responsibility"],0,"The fixed expression is in charge of.","IN CHARGE OF",("person","thing")),
B("We went to {place} in ___ of the rain.",["spite","case","front","place"],0,"The fixed expression is in spite of.","IN SPITE OF",("place",)),
B("{person} and I have a lot in ___.",["common","same","together","similar"],0,"The fixed expression is have something in common.","IN COMMON",("person",)),
B("This change to {topic} may save money in the long ___.",["run","term","way","future"],0,"The fixed expression is in the long run.","IN THE LONG RUN",("topic",))])
SKILLS["fixed_at_on_by"]=("Fixed expressions · at/on/by",[
B("We need at ___ {number} volunteers.",["least","less","last","minimum"],0,"The fixed expression is at least.","AT LEAST",("number",)),
B("{thing} is at ___ of being cancelled.",["risk","danger","chance","threat"],0,"The fixed expression is at risk of.","AT RISK OF",("thing",)),
B("{person} did it on ___.",["purpose","reason","intention","aim"],0,"The fixed expression is on purpose.","ON PURPOSE",("person",)),
B("On ___, visitors spend an hour at {place}.",["average","mean","general","normal"],0,"The fixed expression is on average.","ON AVERAGE",("place",)),
B("{thing} is by ___ the best option.",["far","much","long","way"],0,"The fixed expression is by far.","BY FAR",("thing",))])
SKILLS["say_tell_speak_talk"]=("Say / tell / speak / talk",[
B("Please ___ me what happened to {thing}.",["tell","say","speak","talk"],0,"Tell is used directly with a person: tell me.","TELL + PERSON",("thing",)),
B("{person} didn't ___ anything about {topic}.",["say","tell","speak","talk"],0,"Say can be followed by the thing said without a personal object.","SAY SOMETHING",("person","topic")),
B("{person} can ___ English very well.",["speak","say","tell","talk"],0,"Speak is used for languages.","SPEAK + LANGUAGE",("person",)),
B("We need to ___ about {topic}.",["talk","say","tell","speak to"],0,"Talk about is the natural expression for discussing a topic informally.","TALK ABOUT",("topic",)),
B("Can {person} ___ the difference between the two options?",["tell","say","speak","talk"],0,"Tell the difference is a fixed expression.","TELL THE DIFFERENCE",("person",))])
SKILLS["travel_words"]=("Travel words · journey/trip/travel/tour/route",[
B("The train ___ to {place} took three hours.",["journey","travel","trip","tour"],0,"Journey refers to the act of travelling from one place to another.","TRAIN JOURNEY",("place",)),
B("{person} is away on a business ___.",["trip","journey","travel","route"],0,"Trip is used for a journey and stay, especially for a purpose.","BUSINESS TRIP",("person",)),
B("Air ___ to {place} has become cheaper in recent years.",["travel","journey","trip","tour"],0,"Travel is the general uncountable noun for the activity.","AIR TRAVEL",("place",)),
B("We joined a guided ___ of {place}.",["tour","journey","travel","route"],0,"A tour is an organised visit around a place.","GUIDED TOUR",("place",)),
B("This bus ___ goes past {place}.",["route","journey","travel","tour"],0,"Route is the path followed between places.","BUS ROUTE",("place",))])
SKILLS["work_job_career"]=("Work / job / career / profession / business",[
B("{person} has a lot of ___ to finish {time}.",["work","job","career","profession"],0,"Work is normally uncountable when referring to tasks in general.","WORK = UNCOUNTABLE TASKS",("person","time")),
B("{person} applied for a ___ at {agent}.",["job","work","career","business"],0,"A job is a specific paid position.","APPLY FOR A JOB",("person","agent")),
B("{person} wants a ___ in tourism.",["career","jobbing","workplace","professionally"],0,"Career describes a long-term working life in a field.","CAREER IN",("person",)),
B("{person} sees teaching as a demanding ___.",["profession","career pathing","job work","business"],0,"Profession refers to an occupation requiring specialised training.","PROFESSION",("person",)),
B("{person} runs a small ___.",["business","work","job","career"],0,"Run a business is the natural expression.","RUN A BUSINESS",("person",))])
SKILLS["raise_rise_grow"]=("Raise / rise / grow / lift / arise",[
B("Prices may ___ again {time}.",["rise","raise","lift","arise"],0,"Rise is intransitive: prices rise by themselves.","PRICES RISE",("time",)),
B("{agent} may ___ prices {time}.",["raise","rise","arise","grow"],0,"Raise is transitive and needs an object.","RAISE + OBJECT",("agent","time")),
B("The number of visitors to {place} continues to ___.",["grow","raise","lift","arise"],0,"Grow can mean increase gradually.","GROW = INCREASE",("place",)),
B("{person} couldn't ___ {object} alone.",["lift","rise","raise up","arise"],0,"Lift means physically move something upwards.","LIFT + OBJECT",("person","object")),
B("Problems may ___ if {topic} is ignored.",["arise","raise","rise up","lift"],0,"Arise means occur or begin to exist, especially for problems.","PROBLEMS ARISE",("topic",))])
SKILLS["remember_remind"]=("Remember / remind / recall / recognise / realise",[
B("{person} must remember ___ {thing}.",["to check","checking","reminding","to recall"],0,"Remember to do means not forget a future action.","REMEMBER TO + VERB",("person","thing")),
B("Please ___ {person} to bring {thing}.",["remind","remember","recall","recognise"],0,"Remind someone to do something means make them remember.","REMIND + PERSON + TO",("person","thing")),
B("{person} can clearly ___ meeting the guide.",["recall","remind","recognise","realise"],0,"Recall means remember a past event or fact.","RECALL + MEMORY",("person",)),
B("{person} didn't ___ the man from the photo.",["recognise","remember to","remind","realise of"],0,"Recognise means identify someone or something seen before.","RECOGNISE",("person",)),
B("{person} suddenly ___ that {thing} was missing.",["realised","recognised","reminded","recalled to"],0,"Realise means become aware of a fact.","REALISE + CLAUSE",("person","thing"))])
SKILLS["look_see_watch"]=("Look / see / watch / notice / observe",[
B("{person} stopped to ___ at the map.",["look","see","watch","notice"],0,"Look at means direct your eyes deliberately.","LOOK AT",("person",)),
B("{person} needs to ___ a doctor {time}.",["see","look","watch","observe"],0,"See a doctor is the normal expression for visiting a doctor.","SEE A DOCTOR",("person","time")),
B("{person} wants to ___ the film {time}.",["watch","look","see at","notice"],0,"Watch is used for something viewed over a period of time.","WATCH A FILM",("person","time")),
B("{person} didn't ___ the change in {thing}.",["notice","watch","look","observe at"],0,"Notice means become aware of something.","NOTICE A CHANGE",("person","thing")),
B("Researchers ___ how visitors use {place}.",["observe","watch at","look","see to"],0,"Observe means watch carefully, often for study.","OBSERVE BEHAVIOUR",("place",))])
SKILLS["general_confusables"]=("Common B2 confusables",[
B("Lack of sleep can ___ {effectarea}.",["affect","effect","result","cause to"],0,"Affect is usually the verb meaning influence.","AFFECT = VERB",("effectarea",)),
B("Can {person} ___ my pen {time}?",["borrow","lend","hire","rent"],0,"Borrow means take and use something that belongs to someone else.","BORROW FROM",("person","time")),
B("It would be ___ to check {thing} first.",["sensible","sensitive","serious","aware"],0,"Sensible means practical and reasonable; sensitive means easily affected.","SENSIBLE = PRACTICAL",("thing",)),
B("{person} will ___ the workshop {time}.",["attend","assist","visit to","take"],0,"Attend means be present at an event; assist usually means help.","ATTEND AN EVENT",("person","time")),
B("{person} felt ___ after moving away.",["lonely","alone","single","only"],0,"Lonely describes the unhappy feeling of being without company.","LONELY = FEELING",("person",))])
SKILLS["connectors"]=("B2 connectors · clause or noun?",[
B("___ the heavy rain, we went to {place}.",["Despite","Although","Because","While"],0,"Despite is followed by a noun or -ing form.","DESPITE + NOUN",("place",)),
B("___ it was raining, {person} went out.",["Although","Despite","Because of","During"],0,"Although is followed by a full clause.","ALTHOUGH + CLAUSE",("person",)),
B("{person}'s trip was delayed ___ the weather.",["because of","because","although","unless"],0,"Because of is followed by a noun phrase.","BECAUSE OF + NOUN",("person",)),
B("We won't finish {thing} ___ everyone helps.",["unless","if","while","during"],0,"Unless means if not and introduces a condition.","UNLESS = IF NOT",("thing",)),
B("{person} took notes ___ the meeting.",["during","while","since","for"],0,"During is followed by a noun; while is followed by a clause.","DURING + NOUN",("person",))])
assert len(SKILLS)==25
questions=[]; qid=200001
for si,(cat,(name,bases)) in enumerate(SKILLS.items()):
    assert len(bases)==5
    for bi,base in enumerate(bases):
        for vi in range(24):
            values={k:V[k][vi] for k in base["keys"]}
            q=base["q"].format(**values)
            fp=f"{cat}|{bi}|{vi}|"+re.sub(r"[^a-z0-9]+"," ",q.lower()).strip()
            questions.append({"id":qid,"cat":cat,"skill":name,"templateId":f"{cat}-{bi}","domain":DOMAINS[vi%len(DOMAINS)],"q":q,"a":base["a"],"c":base["c"],"rule":base["rule"],"trigger":base["trigger"],"targetTime":6.0 if si<17 else 6.4,"difficulty":"B2","fingerprint":fp,"focus":[]})
            qid+=1
skills=[{"id":cat,"name":name} for cat,(name,_) in SKILLS.items()]
campaign={"schemaVersion":1,"campaignId":"B2-MCC-C1","title":"Adaptive B2 Multiple-Choice Cloze · Campaign 1","subtitle":"B2 First · Use of English intensive","version":"2026-09-26.1","startingLevel":1,"sessionSize":15,"timeLimit":15,"targetExercises":3000,"questions":questions,"skills":skills}
assert len(questions)==3000 and len({q["fingerprint"] for q in questions})==3000
(OUT/"campaign-01.json").write_text(json.dumps(campaign,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
print("questions",len(questions),"skills",len(skills),"bytes",(OUT/"campaign-01.json").stat().st_size)

def jsdump(x): return json.dumps(x,ensure_ascii=False,separators=(",",":"))
keys={}; lessons={}; coaches={}
for cat,(name,bases) in SKILLS.items():
    b=bases[0]; sample={k:V[k][0] for k in b["keys"]}; q=b["q"].format(**sample); ans=b["a"][b["c"]]; example=q.replace("___",ans)
    keys[cat]={"front":q,"back":example,"formula":b["trigger"],"cue":"Reconoce la combinación exacta antes de elegir."}
    lessons[cat]={"es":"Patrón de examen B2: "+b["rule"],"en":b["rule"],"formula":b["trigger"],"example":example,"translation":"","cue":"Lee la frase completa y elimina los distractores por combinación, régimen o significado."}
    coaches[cat]={"must":"Identifica primero qué combinación exige la frase. "+b["rule"],"secret":"SECRET KEY: "+b["trigger"],"trap":"No elijas por traducción aislada: compara la palabra con las que aparecen inmediatamente antes y después."}
(OUT/"keys.js").write_text("window.AE_KEYS="+jsdump(keys)+";\n",encoding="utf-8")
(OUT/"lessons.js").write_text("window.AE_LESSONS="+jsdump(lessons)+";\n",encoding="utf-8")
(OUT/"error-coach.js").write_text("window.AE_ERROR_COACH="+jsdump(coaches)+";\n",encoding="utf-8")
print("support",len(keys),len(lessons),len(coaches))
