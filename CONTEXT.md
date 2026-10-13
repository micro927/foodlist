# Trip Planner

A shared planner for one group trip: where the couples want to eat, what else they want to do, which neighbourhoods suit what, and a day-by-day plan.

## Language

### People

**Couple**:
One of the travelling pairs (e.g. Micro Bua, Fair Bee). Every "who" in the app is a set of Couples, never individuals.
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
