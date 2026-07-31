# LihukAI

A slow-mover checker for sari-sari stores and small groceries.

Tell it three things about a product that isn't selling — weeks since it last
sold, how long you've stocked it, units sold — and it tells you whether to keep
it, push it (bundle or discount), or stop reordering. Add your price and cost
and it also works out your margin, the cash tied up in unsold units, and
whether a discount would actually make you money.

## The pages

| File | Page | What's on it |
| --- | --- | --- |
| `index.html` | The Checker | The app itself, plus a short sign-off |
| `why.html` | Why It Matters | What dead stock costs a store, with sourced figures |
| `model.html` | The AI Model | How the model was trained and tested, plus the feedback and results forms |

## Assets

| File | Purpose |
| --- | --- |
| `assets/site.css` | Shared stylesheet |
| `assets/model.js` | Trained decision tree, basket-affinity and discount-lift tables, plus shared helpers |
| `assets/checker.js` | The checker (single product + batch table + CSV import) |
| `assets/community.js` | Results logging and the feedback form |
| `assets/logo.svg` | Logo lockup |

Everything is static. Open `index.html` in a browser, or serve the folder from
any static host. Keep the `assets/` folder next to the HTML files.

## Sending results and feedback somewhere

Both forms work with no backend: results are saved in the visitor's browser and
exported as CSV, and feedback opens the visitor's own mail client. To POST to a
real endpoint instead, set either value at the top of `assets/community.js`:

```js
const CONFIG={
  contributeEndpoint:"",  // POST target for logged results
  feedbackEndpoint:""     // POST target for feedback
};
```

The interface reads that config and tells visitors where their data actually
goes, so it never claims to have sent something it hasn't.
