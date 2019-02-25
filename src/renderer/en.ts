export default new Map<String, String>([
  ['tf.c', 'Constant'],
  ['tf.variableFaster', 'Variable - Really Fast (0.0s-0.6s)'],
  ['tf.variableFast', 'Variable - Fast (0.2s-1.2s)'],
  ['tf.variableMedium', 'Variable - Natural (3.0s-5.0s)'],
  ['tf.variableSlow', 'Variable - Slow (3.5s-6.5s)'],
  ['tf.variableSlower', 'Variable - Slower (10s-20s)'],
  ['tf.variableSlowest', 'Variable - Slowest (30s-60s)'],

  ['if.any', 'All images'],
  ['if.gifs', 'Only gifs'],
  ['if.stills', 'Only stills'],

  ['zf.none', 'No zoom'],
  ['zf.in', 'Zoom In'],
  ['zf.out', 'Zoom Out'],

  ['bt.blur', 'Blurred'],
  ['bt.color', 'Solid Color'],

  ['htf.none', 'None'],
  ['htf.left', 'Left'],
  ['htf.right', 'Right'],

  ['vtf.none', 'None'],
  ['vtf.up', 'Up'],
  ['vtf.down', 'Down'],

  ['tot.url', 'URL'],
  ['tot.hastebin', 'Hastebin'],

  ['gt.tumblr', 'Tumblr'],
  ['gt.local', 'Local'],

  ['tt.weight', 'Weight'],
  ['tt.all', 'Require'],
  ['tt.none', 'Exclude'],

  ['sf.alphaA', 'By Title Asc'],
  ['sf.alphaD', 'By Title Desc'],
  ['sf.alphaFullA', 'By Full Title Asc'],
  ['sf.alphaFullD', 'By Full Title Desc'],
  ['sf.dateA', 'By Date Asc'],
  ['sf.dateD', 'By Date Desc'],
  ['sf.type', 'By Type'],

  ['st.tumblr', 'tumblr'],
  ['st.reddit', 'reddit'],
  ['st.list', 'list'],
]);