import ghpages from 'gh-pages';

console.log('Deploying to GitHub Pages...');

ghpages.publish(
  'dist',
  {
    dotfiles: true,
    add: false,  // 既存のファイルを削除してから新しくデプロイ
    src: ['**/*', '!.git/**/*']  // 明示的にすべてのファイルを含める
  },
  (err) => {
    if (err) {
      console.error('Deploy failed:', err);
      process.exit(1);
    } else {
      console.log('Deploy successful!');
      console.log('Please check: https://f-mm7.github.io/electric-chair-game/');
    }
  }
);