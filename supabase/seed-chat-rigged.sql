-- Seed rigged chat messages for multiple variations (comprehensive)
-- Safe re-run: remove previous rigged messages, keep real user messages intact
DELETE FROM chat_messages WHERE is_rigged = true;

DO $$
DECLARE
  v_id SMALLINT;
BEGIN
  FOR v_id IN 1..5 LOOP
    INSERT INTO chat_messages (text, author_username, is_rigged, variation_id, created_at) VALUES
    -- Greetings & openers
    ('What''s up everyone? 👋', 'spicy_toucan92', true, v_id, NOW() - INTERVAL '240 minutes'),
    ('Long time no see here, fam! 😎', 'valley_photographer', true, v_id, NOW() - INTERVAL '235 minutes'),
    ('Good morning from Srinagar! ☀️', 'kashmir_wanderer', true, v_id, NOW() - INTERVAL '230 minutes'),

    -- Travel tips / local info
    ('BTW: Shikara rides are best at sunrise. Less crowd, perfect light. 🌅', 'dal_lake_local', true, v_id, NOW() - INTERVAL '225 minutes'),
    ('FYI, Gulmarg Gondola tickets sell out fast on weekends. Book early! 🚠', 'mountain_explorer_42', true, v_id, NOW() - INTERVAL '220 minutes'),
    ('IMHO, Kahwa at the Mughal Gardens hits different. ☕️🌿', 'garden_stroller', true, v_id, NOW() - INTERVAL '215 minutes'),
    ('AFAIK, Betaab Valley road is clear today—no delays reported. 🚗', 'road_update_bot', true, v_id, NOW() - INTERVAL '210 minutes'),
    ('TL;DR: Weather looks lit 🔥 for the next 3 days, pack layers tho.', 'weather_watch', true, v_id, NOW() - INTERVAL '205 minutes'),

    -- Q&A / community chatter
    ('Anyone tried the new café near Boulevard Rd? Worth the flex or nah? 😅', 'foodie_anon', true, v_id, NOW() - INTERVAL '200 minutes'),
    ('JK but the walnut fudge at Polo View is dangerously good. 💯', 'sweet_tooth', true, v_id, NOW() - INTERVAL '195 minutes'),
    ('IRL meetups this weekend near Dal Gate? Drop a DM. 📩', 'locals_connect', true, v_id, NOW() - INTERVAL '190 minutes'),
    ('SMH at my boots, soaked after a quick drizzle—bring waterproofs! 🥾🌧️', 'trail_runner', true, v_id, NOW() - INTERVAL '185 minutes'),

    -- Short reacts / slang
    ('LOL that shikara doggo in a sweater made my day 😂', 'meme_catcher', true, v_id, NOW() - INTERVAL '180 minutes'),
    ('OMG the view from Apharwat Peak is unreal. TFW clouds part just for you. 🤯', 'peak_hunter', true, v_id, NOW() - INTERVAL '175 minutes'),
    ('LMAO slipped on ice, 10/10 would slide again. ❄️🛷', 'clumsy_penguin', true, v_id, NOW() - INTERVAL '170 minutes'),
    ('BRB, kahwa run. ☕️', 'chai_time', true, v_id, NOW() - INTERVAL '165 minutes'),
    ('AFK for a bit, charging phone 🔋', 'map_navvy', true, v_id, NOW() - INTERVAL '160 minutes'),

    -- Plans / coordination
    ('Anyone up for a quick photo walk at Nishat after 5? Golden hour ftw 📸', 'sunset_snap', true, v_id, NOW() - INTERVAL '155 minutes'),
    ('Yo, any snow reports near Kongdoori today? 🏂', 'powder_chaser', true, v_id, NOW() - INTERVAL '150 minutes'),
    ('GTG in 10, drop your best wazwan recs plz! 😋', 'wazwan_wanderer', true, v_id, NOW() - INTERVAL '145 minutes'),

    -- Opinions / experiences
    ('TBH the houseboat stay was peak cozy vibes. 🔥🛶', 'houseboat_hero', true, v_id, NOW() - INTERVAL '140 minutes'),
    ('On point: hazelnut kahwa at Boulevard spot. Chef''s kiss. 👌', 'taste_tester', true, v_id, NOW() - INTERVAL '135 minutes'),
    ('Facepalm. Forgot sunscreen again. Wear SPF even if it''s cold! 🧴', 'careful_kit', true, v_id, NOW() - INTERVAL '130 minutes'),

    -- Safety / utility
    ('Heads up: roads a bit slick post-rain—slow down on curves. 🛑', 'road_update_bot', true, v_id, NOW() - INTERVAL '125 minutes'),
    ('NP if you''re new here—ask anything, people are super helpful! 🙌', 'friendly_guide', true, v_id, NOW() - INTERVAL '120 minutes'),
    ('TMI maybe, but wool socks > cotton. Your feet will thank you. 🧦', 'gear_geek', true, v_id, NOW() - INTERVAL '115 minutes'),

    -- Weather / status
    ('Current vibes: crisp air, soft sun, low haze. Perfect stroll weather. 🌤️', 'weather_watch', true, v_id, NOW() - INTERVAL '110 minutes'),
    ('Same here—chill breeze by the lake, bring a light jacket. 🧥', 'lakeside_loops', true, v_id, NOW() - INTERVAL '105 minutes'),

    -- Short fun
    ('Mic drop after perfect kahwa brew. 😌☕️', 'chai_time', true, v_id, NOW() - INTERVAL '100 minutes'),
    ('Throwback Thursday: first shikara ride—still magic. 🛶✨', 'nostalgia_notes', true, v_id, NOW() - INTERVAL '95 minutes'),
    ('Clap back at the cold with hot noon chai. 👏🫖', 'winter_mode', true, v_id, NOW() - INTERVAL '90 minutes'),

    -- Recommendations
    ('If you like views, Zojila at sunrise is savage (but bundle up). 🧣', 'view_hunter', true, v_id, NOW() - INTERVAL '85 minutes'),
    ('Flex your cardio on the Apharwat trail; start slow. 🥾', 'fit_and_fair', true, v_id, NOW() - INTERVAL '80 minutes'),
    ('Ship the idea of a kahwa + kangri workshop tour? IRL collab? 🔥', 'culture_buff', true, v_id, NOW() - INTERVAL '75 minutes'),

    -- Logistics
    ('BTW shared taxis from Tangmarg were smooth today. 🛺', 'local_commuter', true, v_id, NOW() - INTERVAL '70 minutes'),
    ('AFAIK, Sonmarg road open till late afternoon only. Plan returns. ⏱️', 'road_update_bot', true, v_id, NOW() - INTERVAL '65 minutes'),

    -- Humor / memes
    ('TFW kahwa warms your soul faster than your jacket. 🧡', 'meme_catcher', true, v_id, NOW() - INTERVAL '60 minutes'),
    ('ROFL at the snowman with sunglasses outside the lodge. 😎⛄️', 'snow_jester', true, v_id, NOW() - INTERVAL '55 minutes'),

    -- Closers
    ('GG on the photo walk, y''all. Pics came out fire. 🔥📷', 'sunset_snap', true, v_id, NOW() - INTERVAL '50 minutes'),
    ('IDC if it''s cliché—Dal Lake sunsets never get old. 💯', 'spicy_toucan92', true, v_id, NOW() - INTERVAL '45 minutes'),
    ('TTYL—battery low, memories high. 🔋✨', 'trail_runner', true, v_id, NOW() - INTERVAL '40 minutes'),
    ('YOLO… but pack snacks. Always. 🍫', 'gear_geek', true, v_id, NOW() - INTERVAL '35 minutes'),
    ('GTG—bus to Pahalgam is here. Catch you later! 🚌', 'locals_connect', true, v_id, NOW() - INTERVAL '30 minutes');
  END LOOP;
END $$;


