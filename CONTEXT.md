# Trip Planner

A shared planner for one group trip: where the couples want to eat, what else they want to do, which neighbourhoods suit what, and a day-by-day plan.

## Language

### People

**Couple**:
One of the travelling pairs (e.g. Micro Bua, Fair Bee). Every "who" in the app is a set of Couples, never individuals — except in Bills, where the "who" is a Person.
_Avoid_: user, person, member

**Me**:
The Couple this phone belongs to; only used to highlight their side.

**Wants to go** (interest):
The Couples who want to visit a Restaurant or Place. Areas have no interest.
_Avoid_: likes, favourites

### Things to visit

**Eats**:
The section listing Restaurants.
_Avoid_: Food (as a section name)

**Restaurant**:
Anywhere to eat or drink — restaurants, cafés, dessert shops, bars. Has a free-text category.
_Avoid_: place (that's a Place), food spot

**Place**:
Somewhere to go that isn't about eating — has one Place category: Shopping, Activity, Photo or Chill.
_Avoid_: spot, attraction, activity (as the general term)

**Area**:
A neighbourhood guide card (e.g. Shibuya) with a cover, map link, Good for tags, inspiration links, notes, and the Restaurants and Places hand-picked into it. An Area cannot be planned and has no interest.
_Avoid_: district, zone, region

**Area name** (on a Restaurant or Place):
Free-text neighbourhood label on a Restaurant or Place. It is not a reference to an Area; matching names only help suggest what to add to an Area.
_Avoid_: location

**Good for**:
The tags on an Area saying what it's good for: Food, Drink, Coffee, Clothes, Groceries, Shopping, Activity, Photo, Chill.
_Avoid_: for, tags, categories

**Groceries**:
The Good for tag for supermarkets, drugstores, konbini and Don Quijote-style stores. Other shopping is **Shopping**; clothing is **Clothes**.

### Plan

**Plan**:
The day-by-day schedule for the trip, with separate Eats and Places tabs.

**Plan entry**:
One Restaurant or Place booked on a day, in a Slot, with an optional time and the Couples Going.
_Avoid_: booking, event, reservation

**Going**:
The Couples attending a Plan entry. All Couples going is shown as **Together**.

**Slot**:
The part of the day a Plan entry sits in. Eats use meal slots (Breakfast, Lunch, Snack, Dinner, Late night); Places use time-of-day slots (Morning, Afternoon, Evening, Night).
_Avoid_: period, session

**Not scheduled yet**:
Restaurants or Places that some Couple wants to go to but that have no Plan entry.

### Bills

Bills stand alone: a Bill is never linked to a Restaurant, Plan entry or Area, even when the names match.

**Person**:
One traveller, belonging to a Couple. The "who" of everything in Bills.
_Avoid_: user, member, diner (as the general term)

**Bill**:
One shared purchase — a meal, konbini run, taxi or anything else paid for the group — with a shop name, a date and time, its Items, one Payer and the People Sharing it. Bills have no Slot; a day's Bills are ordered by time. Only shared spending is recorded, never purchases one Person paid for alone.
_Avoid_: receipt (that's the paper), check, meal (as the record), expense

**Sharing**:
The People a Bill is split among (all four by default). Only People Sharing a Bill can be given its Units.
_Avoid_: diners, participants

**Draft**:
A Bill that isn't fully split yet: no Items, or a Unit no one is given, or a Custom split that doesn't add up. A Draft counts toward no Balance or spend until it's finished.

**Payer**:
The one Person who paid the restaurant for a Bill.

**Item** (on a Bill):
One row of the receipt, with its Japanese name, a rough English name, a quantity and a price. Items come from a Scan and can be added, edited or deleted by hand.
_Avoid_: line, row, entry

**Unit**:
One of the quantity of an Item (Beer ×6 is six Units). A Unit is eaten by one or more People, who split it equally.
_Avoid_: portion, piece

**Custom split**:
The rare way to split an Item unevenly (one pizza, mostly eaten by one Person): pick who ate it, then set each Person's yen amount, which together equal the Item's price. An Item with a Custom split has no Units to give out.
_Avoid_: weights, manual split

**Extra**:
An Item that isn't something eaten, such as tax, service charge or a discount. Extras are spread over People in proportion to what they ate. A table charge (otoshi) is not an Extra; it is an Item with one Unit per Person.
_Avoid_: fee, surcharge

**Share**:
What one Person owes the Payer for one Bill: their Units plus their part of the Extras. Each Share is either paid or unpaid; the Payer's own Share counts as paid.
_Avoid_: portion, cut, split

**Scan**:
Reading a receipt photo into Items, translated roughly from Japanese to English. A service charge on the receipt is folded into the Items' prices rather than kept as an Extra.
_Avoid_: OCR (as the user-facing word), import

**Balance**:
What one Person owes another, from their unpaid Shares to each other netted out.
_Avoid_: debt, tab

**Pay back**:
Marking every unpaid Share between two People as paid (the "Mark paid" on a Balance), so their Balance is zero. Bills are kept; paying back never deletes.
_Avoid_: settle up, clear, reset
