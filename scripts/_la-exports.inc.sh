# Logic Analyzer 共通 API の Wasm エクスポート（cxx/rtlscope_ring.h の RTLSCOPE_EXPORT_RING と対）。
# build-wasm-*.sh から `source` し、EXPORTED_FUNCTIONS の末尾に ${LA_EXPORTS} を連結する。
LA_EXPORTS='"_get_ring_words","_sim_run_n","_sim_freeze_ring","_sim_thaw_ring","_sim_ring_frozen","_sim_set_la","_sim_set_post_delay","_sim_clear_trigger","_sim_set_edge_trigger","_sim_set_value_trigger","_sim_trigger_hit","_sim_trigger_fired","_sim_get_trig_fire_head"'
