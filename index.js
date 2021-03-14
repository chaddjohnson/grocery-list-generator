const fs = require('fs-extra');
const { shuffle, flatten, sortBy, omit, uniq } = require('lodash');
const YAML = require('yamljs');
const csv = require('csv-stringify');

const definiteRecipes = ['general'];
const possibleRecipes = [
  'bean-zucchini-enchiladas',
  'blended-veggie-soup-bread',
  'chicken-sour-cream-enchiladas',
  'chili',
  'coconut-curry-chicken',
  'crock-pot-chicken-noodle-veggie-soup',
  'pasta-complex',
  'pasta-simple',
  'pulled-pork-banh-mi',
  'ramen',
  'salad-bread',
  'salmon-veggies',
  'shrimp-orzo-zucchini',
  'steak-potatoes',
  'tacos',
  'veggie-bowl',
  'white-fish-lentils'
];
const recipeCount = 3;
const yieldFactor = 2;

const getRandomIngredientOption = (options) => {
  const randomOptionNumber = Math.floor(Math.random() * options.length);
  const randomOption = options[randomOptionNumber];

  return randomOption;
};

const processRecipe = async (recipeSlug) => {
  const recipeData = await YAML.load(`./recipes/${recipeSlug}.yaml`);

  const ingredients = recipeData.ingredients.map(
    ({ name, category, quantity, unit, fixedYield, options }) => {
      if (options) {
        return {
          name: getRandomIngredientOption(options),
          category,
          quantity,
          unit,
          fixedYield,
          recipe: recipeData.name
        };
      } else {
        return {
          name,
          category,
          quantity,
          unit,
          fixedYield,
          recipe: recipeData.name
        };
      }
    }
  );

  return ingredients;
};

(async () => {
  const definiteIngredients = await Promise.all(
    definiteRecipes.map(processRecipe)
  );
  const possibleIngredients = await Promise.all(
    shuffle(possibleRecipes).slice(0, recipeCount).map(processRecipe)
  );
  let ingredients = flatten(
    [].concat(definiteIngredients, possibleIngredients)
  );

  ingredients = sortBy(ingredients, ({ name }) => name);
  ingredients = sortBy(ingredients, ({ category }) => category);

  ingredients = Object.values(
    ingredients.reduce((map, ingredient) => {
      const key = ingredient.name.toUpperCase();
      const quantity = (map[key] && map[key].quantity) || 0;
      const recipes = (map[key] && map[key].recipes) || [];
      const ingredientQuantity = ingredient.fixedYield
        ? ingredient.quantity
        : ingredient.quantity * yieldFactor;

      return {
        ...map,
        [key]: {
          ...omit(ingredient, ['recipe']),
          quantity: quantity + ingredientQuantity,
          recipes: recipes.concat(ingredient.recipe)
        }
      };
    }, {})
  );

  const outputFilePath = process.argv[2];
  const writeStream = fs.createWriteStream(outputFilePath);
  const writer = csv({
    quoted: true,
    quotedEmpty: true
  });
  const headers = ['Ingredient', 'Category', 'Quantity', 'Recipes'];
  let data = ingredients.map(({ name, category, quantity, unit, recipes }) => [
    name,
    category,
    `${quantity} ${unit}`,
    recipes.join('\n')
  ]);
  const recipes = uniq(
    flatten(ingredients.map(({ recipes }) => recipes))
  ).sort();

  data = recipes.map((name) => ['', '', '', name]).concat(data);
  data = [
    ['', '', '', `Recipe yield factor = ${yieldFactor}`],
    ['', '', '', '']
  ].concat(data);

  await new Promise((resolve, reject) => {
    writeStream.on('finish', () => resolve());
    writeStream.on('error', reject);

    writer.pipe(writeStream);

    writer.write(headers);
    data.map((item) => writer.write(item));

    writer.end();
  });
})();
