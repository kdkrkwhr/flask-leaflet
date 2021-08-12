from flask import Flask, render_template

app = Flask(__name__)

@app.route("/page/wind", methods=['GET'])
def wind_map_page():
  return render_template('page/wind.html')

@app.route("/page/heatDraw", methods=['GET'])
def heat_draw_map_page():
  return render_template('page/heat_draw.html')

@app.route("/page/cluster", methods=['GET'])
def cluster_draw_map_page():
  return render_template('page/cluster.html')

@app.route("/page/cctv", methods=['GET'])
def cctv_map_page():
  return render_template('page/cctv_map.html')

@app.route("/page/3d", methods=['GET'])
def map_3d_draw_map_page():
  return render_template('page/map_3d.html')

if __name__ == "__main__": 
  app.run(host='0.0.0.0', port=8000, debug=True)


