#!/bin/bash
# Run inside a clone of Visualizer.
# 1) Fetches every branch and saves a local backup ref (refs/backup/<branch>) for each one to be deleted.
# 2) Deletes each branch on GitHub only if it is still at the commit audited on 2026-11-11.
# To restore one: git push origin refs/backup/<branch>:refs/heads/<branch>
set -e
git fetch origin '+refs/heads/*:refs/remotes/origin/*'
git update-ref refs/backup/claude/gracious-hopper-adin8j 856d2e0e9f8b03e4f176bdd18c238d827b1fe6e6
git update-ref refs/backup/claude/access-visualizer-64euna 8c6ddd6a577ef405fe99ff7738fcd2db6489e6a3
git update-ref refs/backup/claude/multi-auto-timing c8dfeac18ee856a8ec41626d4d2cb5f7354cabc2
git update-ref refs/backup/claude/team-autos-default c33073c727533b521a2173a708988443b4705ea6
git update-ref refs/backup/claude/team-autos a9b1effd3a2b20806a64332ccb83031e6fe9b61b
git update-ref refs/backup/claude/timing-model fdfacd5b0a6b44e977eac0607fe2e4ebe988e605
git update-ref refs/backup/claude/happy-cray-e7jwi3 523b806e8a01ea53bc32c2278448fcb8ebf6353a
git update-ref refs/backup/claude/upstream-v2.5 6c3e8cdd1c459809a028a0d3b13b744b270d91db
git update-ref refs/backup/claude/ladders 9240ba98989bd05822b91b8c239bd62f94bde888
git update-ref refs/backup/claude/plan-view 82a2b59d11a2ce4a3a8c0e19b709fa4fa5ebed63
git update-ref refs/backup/claude/advantagescope-help becbb813e27752bc1868cec10ceb8751676560b7
git update-ref refs/backup/claude/auto-saved-stamp 8b4aa58c88175c4ff88844437f85de7fa3136d46
git update-ref refs/backup/claude/files-biobuzz-first b0a9bf6130d0644658dcfefadc81792ee6628c08
git update-ref refs/backup/claude/files-from-biobuzz 794fa99e04c53bcf1c49ab882abbbded57e01703
git update-ref refs/backup/claude/nice-bardeen-den3xr e7f1348c285d423ba63c5d7b5e3af0634f5d615e
git update-ref refs/backup/claude/pick-square-up e0f053d2505e41614bb89d9eedc6917004d11493
git update-ref refs/backup/claude/simple-spinup bdb2479e352f1d677f866392756db313f24daff9
git update-ref refs/backup/claude/unlock-start-spot 4a535816d29189e06f676503e1d8ce7b93aad752
git update-ref refs/backup/claude/visualizer-fast-lane 4acf1cb3ee2eaaeec3eb077fbd40744bb0d1b6db
git update-ref refs/backup/claude/draft-waits 7257c1e4d9ab4459891372dc166dfced0a9b7250
git update-ref refs/backup/claude/otherwise-paths c07ac6d7a0b7893a62603021d56e00f2bdc7f3d8
git update-ref refs/backup/claude/otherwise-preview 0424ba0fd0f82bfaa6a263e0baeb692497880698
git update-ref refs/backup/claude/simple-otherwise 4ac6ef52c72f8ec0e441d3c5bf068f39fa8189ea
git update-ref refs/backup/claude/spot-names 242b9dcab1486b0f0a5a99b5752a3324bf625641
git update-ref refs/backup/claude/spots-token da0897470ffaf1e8326a9334179084f2b05decf6
git update-ref refs/backup/claude/team-dialog-branch ec546e85cd3781d1ee24d59700bbd7ebfbb41ede
git update-ref refs/backup/claude/team-link-opens 420995f2b11c5517b65da77feeee9db690db3a35
git update-ref refs/backup/cellup-wait 228859b8cb50b8be9f00726b3161de8e995df774
git update-ref refs/backup/claude/amazing-cerf-mblmmq 16d6cb5bbf401fed4978462ace0b847a1de938c9
git update-ref refs/backup/claude/match-controls a2c2ad30413f26d10a8971e362e7187cc848a847
git update-ref refs/backup/claude/match-polish cb3e4a85ab1c698fa6c4d8c7bc9412ca085d9bbd
git update-ref refs/backup/claude/new-session-a2aaji f2a64d95691d1fe0269a54f75218e15e95abc6d5
git update-ref refs/backup/claude/optimistic-goodall-e7wiru dc66b1aff1c22e6fe081b81944cd7e51fc4e7d6c
git update-ref refs/backup/claude/partner-last-shot-wording ef4b9913d90c5046a7c22eb7120b3b89ff7ac1d7
git update-ref refs/backup/claude/pick-stick-on-drive-in e9392460c434fd4d0d73e5b044c7a53e0ede63c2
git update-ref refs/backup/claude/save-to-repo-folder b5c2344c99eeab6197d6c68a21076c97143469cc
git update-ref refs/backup/claude/sim-partner-runs 8af6dc9d93d31e1827d642fb450b1405d14ec164
git update-ref refs/backup/claude/team-autos-overlays 7366b7315c7b4ff8d908564ef40191935cef2a47
git update-ref refs/backup/claude/timing-facts-cleanup 7622559b76695a04ae8970bdee83addb246c80eb
git update-ref refs/backup/claude/wizardly-clarke-uwllvg dac44bb4d5aaeafd1a6ea84832ee9e2a3ba66c8b
git update-ref refs/backup/claude/youthful-meitner-uocoav c6b05892a4279ff7ecbfd7c2525353dec9ab838c
git update-ref refs/backup/claude/zen-johnson-02mavt 4ffbedf476532de2d1fa5b25cb6fd7aad12be5ee
git update-ref refs/backup/claude/bold-ptolemy-aabda1 8bde86c71592c59a264711c13bed48ce6d8a6076
git update-ref refs/backup/claude/epic-lovelace-s2z97f 67d976e857c4382e7fe63a8f63f6a5abfa10bf28
git update-ref refs/backup/claude/fervent-goodall-5dvsc7 ba19582d943b0e8d941efee89f0d4b5fce7e47b4
git update-ref refs/backup/claude/friendly-planck-ughuzy 0804ea56d04fa2758bf3d4543c036b6b96ce8964
git update-ref refs/backup/claude/start-facing bafed5273cc912705920b8c4e3a8aa9ad04f95b9
git update-ref refs/backup/claude/team-autos-drafts d99d9edac4169859839706626926d97972384af8
git update-ref refs/backup/codex/belding-local-workspace 7f0293e42048f226b8ba8bc25c1cc4c8c4396add
git update-ref refs/backup/fix/preserve-piecewise-headings 13058f9d8a4f64999d552460d43e7c8b23bcc4ed
git update-ref refs/backup/fix/reversed-linear-long-way 6da5d0d519a38268f3bc81541a95a7d7fb8fcb2d
git update-ref refs/backup/claude/sim-stale-designs ca85d332e71d98bfd8013edee3230cb76ec3a279
git update-ref refs/backup/claude/ci d7b3539e170ac36bf75502a0a1ac62c45b6e2f58
git update-ref refs/backup/claude/game-verb-presets f729c7795356c6d5153c9197078febd02b92c834
git update-ref refs/backup/claude/preview-drive-speed a7d702591b919ac607406ad8de4b3b295ec43b4b
git update-ref refs/backup/claude/partner-wait f24b453d25089611e019e290f1865825f7da7817
echo "Backups saved: $(git for-each-ref refs/backup | wc -l)"
git push origin \
  --force-with-lease=claude/gracious-hopper-adin8j:856d2e0e9f8b03e4f176bdd18c238d827b1fe6e6 :refs/heads/claude/gracious-hopper-adin8j \
  --force-with-lease=claude/access-visualizer-64euna:8c6ddd6a577ef405fe99ff7738fcd2db6489e6a3 :refs/heads/claude/access-visualizer-64euna \
  --force-with-lease=claude/multi-auto-timing:c8dfeac18ee856a8ec41626d4d2cb5f7354cabc2 :refs/heads/claude/multi-auto-timing \
  --force-with-lease=claude/team-autos-default:c33073c727533b521a2173a708988443b4705ea6 :refs/heads/claude/team-autos-default \
  --force-with-lease=claude/team-autos:a9b1effd3a2b20806a64332ccb83031e6fe9b61b :refs/heads/claude/team-autos \
  --force-with-lease=claude/timing-model:fdfacd5b0a6b44e977eac0607fe2e4ebe988e605 :refs/heads/claude/timing-model \
  --force-with-lease=claude/happy-cray-e7jwi3:523b806e8a01ea53bc32c2278448fcb8ebf6353a :refs/heads/claude/happy-cray-e7jwi3 \
  --force-with-lease=claude/upstream-v2.5:6c3e8cdd1c459809a028a0d3b13b744b270d91db :refs/heads/claude/upstream-v2.5 \
  --force-with-lease=claude/ladders:9240ba98989bd05822b91b8c239bd62f94bde888 :refs/heads/claude/ladders \
  --force-with-lease=claude/plan-view:82a2b59d11a2ce4a3a8c0e19b709fa4fa5ebed63 :refs/heads/claude/plan-view \
  --force-with-lease=claude/advantagescope-help:becbb813e27752bc1868cec10ceb8751676560b7 :refs/heads/claude/advantagescope-help \
  --force-with-lease=claude/auto-saved-stamp:8b4aa58c88175c4ff88844437f85de7fa3136d46 :refs/heads/claude/auto-saved-stamp \
  --force-with-lease=claude/files-biobuzz-first:b0a9bf6130d0644658dcfefadc81792ee6628c08 :refs/heads/claude/files-biobuzz-first \
  --force-with-lease=claude/files-from-biobuzz:794fa99e04c53bcf1c49ab882abbbded57e01703 :refs/heads/claude/files-from-biobuzz \
  --force-with-lease=claude/nice-bardeen-den3xr:e7f1348c285d423ba63c5d7b5e3af0634f5d615e :refs/heads/claude/nice-bardeen-den3xr \
  --force-with-lease=claude/pick-square-up:e0f053d2505e41614bb89d9eedc6917004d11493 :refs/heads/claude/pick-square-up \
  --force-with-lease=claude/simple-spinup:bdb2479e352f1d677f866392756db313f24daff9 :refs/heads/claude/simple-spinup \
  --force-with-lease=claude/unlock-start-spot:4a535816d29189e06f676503e1d8ce7b93aad752 :refs/heads/claude/unlock-start-spot \
  --force-with-lease=claude/visualizer-fast-lane:4acf1cb3ee2eaaeec3eb077fbd40744bb0d1b6db :refs/heads/claude/visualizer-fast-lane \
  --force-with-lease=claude/draft-waits:7257c1e4d9ab4459891372dc166dfced0a9b7250 :refs/heads/claude/draft-waits \
  --force-with-lease=claude/otherwise-paths:c07ac6d7a0b7893a62603021d56e00f2bdc7f3d8 :refs/heads/claude/otherwise-paths \
  --force-with-lease=claude/otherwise-preview:0424ba0fd0f82bfaa6a263e0baeb692497880698 :refs/heads/claude/otherwise-preview \
  --force-with-lease=claude/simple-otherwise:4ac6ef52c72f8ec0e441d3c5bf068f39fa8189ea :refs/heads/claude/simple-otherwise \
  --force-with-lease=claude/spot-names:242b9dcab1486b0f0a5a99b5752a3324bf625641 :refs/heads/claude/spot-names \
  --force-with-lease=claude/spots-token:da0897470ffaf1e8326a9334179084f2b05decf6 :refs/heads/claude/spots-token \
  --force-with-lease=claude/team-dialog-branch:ec546e85cd3781d1ee24d59700bbd7ebfbb41ede :refs/heads/claude/team-dialog-branch \
  --force-with-lease=claude/team-link-opens:420995f2b11c5517b65da77feeee9db690db3a35 :refs/heads/claude/team-link-opens \
  --force-with-lease=cellup-wait:228859b8cb50b8be9f00726b3161de8e995df774 :refs/heads/cellup-wait \
  --force-with-lease=claude/amazing-cerf-mblmmq:16d6cb5bbf401fed4978462ace0b847a1de938c9 :refs/heads/claude/amazing-cerf-mblmmq \
  --force-with-lease=claude/match-controls:a2c2ad30413f26d10a8971e362e7187cc848a847 :refs/heads/claude/match-controls \
  --force-with-lease=claude/match-polish:cb3e4a85ab1c698fa6c4d8c7bc9412ca085d9bbd :refs/heads/claude/match-polish \
  --force-with-lease=claude/new-session-a2aaji:f2a64d95691d1fe0269a54f75218e15e95abc6d5 :refs/heads/claude/new-session-a2aaji \
  --force-with-lease=claude/optimistic-goodall-e7wiru:dc66b1aff1c22e6fe081b81944cd7e51fc4e7d6c :refs/heads/claude/optimistic-goodall-e7wiru \
  --force-with-lease=claude/partner-last-shot-wording:ef4b9913d90c5046a7c22eb7120b3b89ff7ac1d7 :refs/heads/claude/partner-last-shot-wording \
  --force-with-lease=claude/pick-stick-on-drive-in:e9392460c434fd4d0d73e5b044c7a53e0ede63c2 :refs/heads/claude/pick-stick-on-drive-in \
  --force-with-lease=claude/save-to-repo-folder:b5c2344c99eeab6197d6c68a21076c97143469cc :refs/heads/claude/save-to-repo-folder \
  --force-with-lease=claude/sim-partner-runs:8af6dc9d93d31e1827d642fb450b1405d14ec164 :refs/heads/claude/sim-partner-runs \
  --force-with-lease=claude/team-autos-overlays:7366b7315c7b4ff8d908564ef40191935cef2a47 :refs/heads/claude/team-autos-overlays \
  --force-with-lease=claude/timing-facts-cleanup:7622559b76695a04ae8970bdee83addb246c80eb :refs/heads/claude/timing-facts-cleanup \
  --force-with-lease=claude/wizardly-clarke-uwllvg:dac44bb4d5aaeafd1a6ea84832ee9e2a3ba66c8b :refs/heads/claude/wizardly-clarke-uwllvg \
  --force-with-lease=claude/youthful-meitner-uocoav:c6b05892a4279ff7ecbfd7c2525353dec9ab838c :refs/heads/claude/youthful-meitner-uocoav \
  --force-with-lease=claude/zen-johnson-02mavt:4ffbedf476532de2d1fa5b25cb6fd7aad12be5ee :refs/heads/claude/zen-johnson-02mavt \
  --force-with-lease=claude/bold-ptolemy-aabda1:8bde86c71592c59a264711c13bed48ce6d8a6076 :refs/heads/claude/bold-ptolemy-aabda1 \
  --force-with-lease=claude/epic-lovelace-s2z97f:67d976e857c4382e7fe63a8f63f6a5abfa10bf28 :refs/heads/claude/epic-lovelace-s2z97f \
  --force-with-lease=claude/fervent-goodall-5dvsc7:ba19582d943b0e8d941efee89f0d4b5fce7e47b4 :refs/heads/claude/fervent-goodall-5dvsc7 \
  --force-with-lease=claude/friendly-planck-ughuzy:0804ea56d04fa2758bf3d4543c036b6b96ce8964 :refs/heads/claude/friendly-planck-ughuzy \
  --force-with-lease=claude/start-facing:bafed5273cc912705920b8c4e3a8aa9ad04f95b9 :refs/heads/claude/start-facing \
  --force-with-lease=claude/team-autos-drafts:d99d9edac4169859839706626926d97972384af8 :refs/heads/claude/team-autos-drafts \
  --force-with-lease=codex/belding-local-workspace:7f0293e42048f226b8ba8bc25c1cc4c8c4396add :refs/heads/codex/belding-local-workspace \
  --force-with-lease=fix/preserve-piecewise-headings:13058f9d8a4f64999d552460d43e7c8b23bcc4ed :refs/heads/fix/preserve-piecewise-headings \
  --force-with-lease=fix/reversed-linear-long-way:6da5d0d519a38268f3bc81541a95a7d7fb8fcb2d :refs/heads/fix/reversed-linear-long-way \
  --force-with-lease=claude/sim-stale-designs:ca85d332e71d98bfd8013edee3230cb76ec3a279 :refs/heads/claude/sim-stale-designs \
  --force-with-lease=claude/ci:d7b3539e170ac36bf75502a0a1ac62c45b6e2f58 :refs/heads/claude/ci \
  --force-with-lease=claude/game-verb-presets:f729c7795356c6d5153c9197078febd02b92c834 :refs/heads/claude/game-verb-presets \
  --force-with-lease=claude/preview-drive-speed:a7d702591b919ac607406ad8de4b3b295ec43b4b :refs/heads/claude/preview-drive-speed \
  --force-with-lease=claude/partner-wait:f24b453d25089611e019e290f1865825f7da7817 :refs/heads/claude/partner-wait \
  && git fetch --prune origin
git push origin --delete claude/festive-lamport-ertfqs || true
echo "Done. Backups are under refs/backup/ in this clone."
