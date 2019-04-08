from httpServer import SimpleHTTPRequestHandler, HTTPServer
from cryptopt.theoEngine import TheoEngine
import os

data_path = os.getcwd() + '/volData/'

if not os._exists(data_path):
    os.mkdir(data_path)

class Server(SimpleHTTPRequestHandler):

    # def do_POST(self):
    #     content_length = int(self.headers['Content-Length']) # <--- Gets the size of data
    #     post_data = self.rfile.read(content_length).decode('utf-8')
    #     fields = urllib.parse.parse_qs(post_data)
    #     raw_messages = str(fields[' name']).split("'")
    #     data = {}
    #
    #     for raw_message in raw_messages:
    #         try:
    #             key = ''
    #             value = ''
    #             key_split = raw_message.split('"')
    #             if len(key_split) >= 2:
    #                 key = key_split[1]
    #             value_split_1 = raw_message.split("\\n")
    #             if len(value_split_1) >= 3:
    #                 value_split_2 = value_split_1[2].split('\\r')
    #                 if len(value_split_2) >=1:
    #                     value = value_split_2[0]
    #             if key and value:
    #                 data[key] = value
    #         except Exception as e:
    #             print('error decoding data: ' + str(e))
    #
    #     self.processData(data)

    def do_GET(self):
        f = self.send_head()
        if f:
            try:
                self.copyfile(f, self.wfile)
            finally:
                f.close()

def runServer(server_class=HTTPServer, handler_class=Server, port=8000):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print('Server running at localhost:' + str(port) + '...')
    httpd.serve_forever()


theo_engine = TheoEngine("BTC/USD")
# theo_engine.build_deribit_options()
# theo_engine.calc_deribit_implied_vols()
# theo_engine.calc_all_greeks()

print("Running server...")
runServer()
