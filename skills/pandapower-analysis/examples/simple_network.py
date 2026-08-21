"""Small balanced network for pandapower-analysis smoke tests."""
import pandapower as pp

net = pp.create_empty_network(name="pandapower-analysis example", sn_mva=100.0)

bus_grid = pp.create_bus(net, vn_kv=110.0, name="Grid bus")
bus_load = pp.create_bus(net, vn_kv=110.0, name="Load bus")

ext_grid = pp.create_ext_grid(net, bus_grid, vm_pu=1.0, name="Utility")
net.ext_grid.loc[ext_grid, "s_sc_max_mva"] = 1000.0
net.ext_grid.loc[ext_grid, "s_sc_min_mva"] = 500.0
net.ext_grid.loc[ext_grid, "rx_max"] = 0.1
net.ext_grid.loc[ext_grid, "rx_min"] = 0.1

line = pp.create_line_from_parameters(
    net,
    from_bus=bus_grid,
    to_bus=bus_load,
    length_km=1.0,
    r_ohm_per_km=0.2,
    x_ohm_per_km=0.4,
    c_nf_per_km=10.0,
    max_i_ka=1.0,
    name="Grid-to-load line",
)
net.line.loc[line, "endtemp_degree"] = 20.0

pp.create_load(net, bus_load, p_mw=20.0, q_mvar=5.0, name="Example load")
